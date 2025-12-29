"use server"

import { createClient } from "@sanity/client"

export interface PostData {
  title: string
  slug: string
  content: string
  image?: string
  price: number
  category: string[]
}

export interface Post {
  _id: string
  _createdAt: string
  title: string
  slug: {
    current: string
  }
  content: string
  image?: string
  price: number
  category: string | string[] // Accept both string and array for backward compatibility
}

function getReadClient() {
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: "2024-12-01",
    useCdn: false,
  })
}

export async function uploadImage(formData: FormData) {
  try {
    console.log("[v0] Starting image upload to Sanity...")

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
    const writeToken = process.env.SANITY_API_WRITE_TOKEN

    if (!projectId) {
      throw new Error("NEXT_PUBLIC_SANITY_PROJECT_ID is not configured.")
    }
    if (!dataset) {
      throw new Error("NEXT_PUBLIC_SANITY_DATASET is not configured.")
    }
    if (!writeToken) {
      throw new Error("SANITY_API_WRITE_TOKEN is not configured.")
    }

    const file = formData.get("file") as File
    if (!file) {
      throw new Error("No file provided")
    }

    console.log("[v0] Uploading file:", file.name, "Type:", file.type, "Size:", file.size)

    const buffer = await file.arrayBuffer()

    const apiVersion = "v2024-12-01"
    const url = `https://${projectId}.api.sanity.io/${apiVersion}/assets/images/${dataset}?filename=${encodeURIComponent(file.name)}`

    console.log("[v0] Upload URL:", url)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        Authorization: `Bearer ${writeToken}`,
      },
      body: buffer,
    })

    console.log("[v0] Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Sanity API error:", response.status, errorText)
      throw new Error(`Sanity API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    console.log("[v0] Image upload response:", JSON.stringify(result))

    const imageUrl = result?.document?.url

    if (!imageUrl) {
      console.error("[v0] Response structure:", result)
      throw new Error("Upload succeeded but no URL returned from Sanity")
    }

    console.log("[v0] Successfully uploaded image, URL:", imageUrl)

    return {
      success: true,
      url: imageUrl,
    }
  } catch (error) {
    console.error("[v0] Error uploading image to Sanity:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function createPost(postData: PostData) {
  try {
    console.log("[v0] Checking environment variables...")

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
    const writeToken = process.env.SANITY_API_WRITE_TOKEN

    console.log("[v0] NEXT_PUBLIC_SANITY_PROJECT_ID:", projectId ? "Set" : "MISSING")
    console.log("[v0] NEXT_PUBLIC_SANITY_DATASET:", dataset ? "Set" : "MISSING")
    console.log("[v0] SANITY_API_WRITE_TOKEN:", writeToken ? "Set (length: " + writeToken.length + ")" : "MISSING")

    if (!projectId || !dataset) {
      throw new Error("Sanity project configuration is missing.")
    }

    if (!writeToken) {
      throw new Error(
        "SANITY_API_WRITE_TOKEN is not configured. Please add it to your environment variables with Editor or Administrator permissions.",
      )
    }

    const normalizedSlug = postData.slug.toLowerCase().trim()
    console.log("[v0] Checking for duplicate slug:", normalizedSlug)

    const client = getReadClient()
    const existingPosts = await client.fetch<Post[]>(`*[_type == "post" && slug.current == $slug]`, {
      slug: normalizedSlug,
    })

    console.log("[v0] Existing posts with this slug:", existingPosts?.length || 0)

    if (existingPosts && existingPosts.length > 0) {
      console.log("[v0] Duplicate slug found:", normalizedSlug)
      throw new Error(`A post with the slug "${normalizedSlug}" already exists. Please choose a different slug.`)
    }
    console.log("[v0] Slug is unique, proceeding with creation")

    console.log("[v0] Creating post with data:", postData)

    const doc = {
      _type: "post",
      title: postData.title,
      slug: {
        _type: "slug",
        current: normalizedSlug, // Use normalized slug
      },
      content: postData.content,
      price: postData.price,
      category: Array.isArray(postData.category) ? postData.category : [postData.category], // Convert string to array if necessary
      ...(postData.image && { image: postData.image }),
    }

    console.log("[v0] Document to create:", doc)

    // Use Sanity HTTP API directly for better error handling
    const apiVersion = "v2024-12-01"
    const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/mutate/${dataset}`

    const mutations = [
      {
        create: doc,
      },
    ]

    console.log("[v0] Sending mutation to:", url)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writeToken}`,
      },
      body: JSON.stringify({ mutations }),
    })

    console.log("[v0] Create response status:", response.status)

    const result = await response.json()
    console.log("[v0] Create response:", JSON.stringify(result))

    if (!response.ok) {
      console.error("[v0] Sanity API error:", response.status, result)

      // Check for permission error
      if (response.status === 403 || result?.error?.type === "mutationError") {
        throw new Error(
          `Permission denied: Your SANITY_API_WRITE_TOKEN does not have "create" permission. Please generate a new token with Editor or Administrator role in your Sanity project settings.`,
        )
      }

      throw new Error(`Sanity API error (${response.status}): ${JSON.stringify(result)}`)
    }

    console.log("[v0] Created post successfully")

    return { success: true, data: result }
  } catch (error) {
    console.error("[v0] Error adding post to Sanity:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    console.error("[v0] Error details:", errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function getPosts() {
  try {
    console.log("[v0] Fetching posts from Sanity...")

    const client = getReadClient()

    const posts = await client.fetch<Post[]>(
      `*[_type == "post"] | order(_createdAt desc) {
        _id,
        _createdAt,
        title,
        slug,
        content,
        image,
        price,
        category
      }`,
    )

    console.log("[v0] Fetched posts:", posts)
    console.log("[v0] Number of posts:", posts?.length || 0)

    return { success: true, data: posts || [] }
  } catch (error) {
    console.error("[v0] Error fetching posts from Sanity:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      data: [],
    }
  }
}

export async function deletePost(postId: string) {
  try {
    console.log("[v0] Deleting post with ID:", postId)

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
    const writeToken = process.env.SANITY_API_WRITE_TOKEN

    if (!projectId || !dataset || !writeToken) {
      throw new Error("Sanity configuration is missing.")
    }

    const apiVersion = "v2024-12-01"
    const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/mutate/${dataset}`

    const mutations = [
      {
        delete: { id: postId },
      },
    ]

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writeToken}`,
      },
      body: JSON.stringify({ mutations }),
    })

    if (!response.ok) {
      const result = await response.json()
      console.error("[v0] Sanity delete error:", result)
      throw new Error(`Failed to delete post: ${JSON.stringify(result)}`)
    }

    const result = await response.json()
    console.log("[v0] Deleted post result:", result)

    return { success: true }
  } catch (error) {
    console.error("[v0] Error deleting post from Sanity:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function updatePostCategory(postId: string, categories: string | string[]) {
  try {
    console.log("[v0] Updating categories for post:", postId, "to:", categories)

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
    const writeToken = process.env.SANITY_API_WRITE_TOKEN

    if (!projectId || !dataset || !writeToken) {
      throw new Error("Sanity configuration is missing.")
    }

    const apiVersion = "v2024-12-01"
    const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/mutate/${dataset}`

    const mutations = [
      {
        patch: {
          id: postId,
          set: { category: Array.isArray(categories) ? categories : [categories] }, // Convert string to array if necessary
        },
      },
    ]

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writeToken}`,
      },
      body: JSON.stringify({ mutations }),
    })

    if (!response.ok) {
      const result = await response.json()
      console.error("[v0] Sanity update error:", result)
      throw new Error(`Failed to update categories: ${JSON.stringify(result)}`)
    }

    const result = await response.json()
    console.log("[v0] Updated categories result:", result)

    return { success: true }
  } catch (error) {
    console.error("[v0] Error updating categories:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function exportPostsToCSV() {
  try {
    console.log("[v0] Exporting posts to CSV...")

    const result = await getPosts()

    if (!result.success || !result.data) {
      throw new Error("Failed to fetch posts")
    }

    const posts = result.data

    // CSV headers
    const headers = ["ID", "Title", "Slug", "Content", "Image", "Price", "Categories", "Created At"]

    // Convert posts to CSV rows
    const rows = posts.map((post) => {
      const categories = Array.isArray(post.category) ? post.category.join(";") : post.category || ""

      return [
        post._id,
        `"${post.title.replace(/"/g, '""')}"`, // Escape quotes
        post.slug.current,
        `"${post.content.replace(/"/g, '""')}"`, // Escape quotes
        post.image || "",
        post.price,
        `"${categories}"`,
        post._createdAt,
      ].join(",")
    })

    // Combine headers and rows
    const csv = [headers.join(","), ...rows].join("\n")

    console.log("[v0] CSV export completed, rows:", rows.length)

    return { success: true, csv }
  } catch (error) {
    console.error("[v0] Error exporting posts to CSV:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function importPostsFromCSV(csvData: string) {
  try {
    console.log("[v0] Importing posts from CSV...")

    const lines = csvData.trim().split("\n")

    if (lines.length < 2) {
      throw new Error("CSV file is empty or invalid")
    }

    // Skip header row
    const dataLines = lines.slice(1)

    const imported: string[] = []
    const errors: string[] = []

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim()
      if (!line) continue

      try {
        // Parse CSV line (handles quoted fields)
        const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || []
        const cleanFields = fields.map((f) => f.replace(/^"|"$/g, "").replace(/""/g, '"'))

        if (cleanFields.length < 7) {
          throw new Error(`Invalid CSV format at row ${i + 2}`)
        }

        const [, title, slug, content, image, priceStr, categoriesStr] = cleanFields

        const price = Number.parseFloat(priceStr)
        if (isNaN(price)) {
          throw new Error(`Invalid price at row ${i + 2}`)
        }

        const categories = categoriesStr ? categoriesStr.split(";").filter((c) => c.trim()) : []

        const postData: PostData = {
          title: title.trim(),
          slug: slug.trim(),
          content: content.trim(),
          image: image.trim() || undefined,
          price,
          category: categories,
        }

        const result = await createPost(postData)

        if (result.success) {
          imported.push(title)
        } else {
          errors.push(`Row ${i + 2} (${title}): ${result.error}`)
        }
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    console.log("[v0] CSV import completed. Imported:", imported.length, "Errors:", errors.length)

    return {
      success: true,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error("[v0] Error importing posts from CSV:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function addCategoryToPost(postId: string, category: string) {
  try {
    console.log("[v0] Adding category to post:", postId, "category:", category)

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
    const writeToken = process.env.SANITY_API_WRITE_TOKEN

    if (!projectId || !dataset || !writeToken) {
      throw new Error("Sanity configuration is missing.")
    }

    const client = getReadClient()
    const post = await client.fetch<Post>(`*[_type == "post" && _id == $id][0]`, { id: postId })

    if (!post) {
      throw new Error("Post not found")
    }

    const currentCategories = Array.isArray(post.category) ? post.category : post.category ? [post.category] : []

    if (currentCategories.includes(category)) {
      return { success: true, message: "Category already exists" }
    }

    const updatedCategories = [...currentCategories, category]

    const apiVersion = "v2024-12-01"
    const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/mutate/${dataset}`

    const mutations = [
      {
        patch: {
          id: postId,
          set: { category: updatedCategories },
        },
      },
    ]

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writeToken}`,
      },
      body: JSON.stringify({ mutations }),
    })

    if (!response.ok) {
      const result = await response.json()
      console.error("[v0] Sanity update error:", result)
      throw new Error(`Failed to add category: ${JSON.stringify(result)}`)
    }

    const result = await response.json()
    console.log("[v0] Added category result:", result)

    return { success: true }
  } catch (error) {
    console.error("[v0] Error adding category:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function removeCategoryFromPost(postId: string, category: string) {
  try {
    console.log("[v0] Removing category from post:", postId, "category:", category)

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
    const writeToken = process.env.SANITY_API_WRITE_TOKEN

    if (!projectId || !dataset || !writeToken) {
      throw new Error("Sanity configuration is missing.")
    }

    const client = getReadClient()
    const post = await client.fetch<Post>(`*[_type == "post" && _id == $id][0]`, { id: postId })

    if (!post) {
      throw new Error("Post not found")
    }

    const currentCategories = Array.isArray(post.category) ? post.category : post.category ? [post.category] : []

    const updatedCategories = currentCategories.filter((c) => c !== category)

    const apiVersion = "v2024-12-01"
    const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/mutate/${dataset}`

    const mutations = [
      {
        patch: {
          id: postId,
          set: { category: updatedCategories },
        },
      },
    ]

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writeToken}`,
      },
      body: JSON.stringify({ mutations }),
    })

    if (!response.ok) {
      const result = await response.json()
      console.error("[v0] Sanity update error:", result)
      throw new Error(`Failed to remove category: ${JSON.stringify(result)}`)
    }

    const result = await response.json()
    console.log("[v0] Removed category result:", result)

    return { success: true }
  } catch (error) {
    console.error("[v0] Error removing category:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}
