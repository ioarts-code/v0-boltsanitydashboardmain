"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  createPost,
  getPosts,
  deletePost,
  uploadImage,
  updatePostCategory,
  exportPostsToCSV,
  importPostsFromCSV,
  addCategoryToPost,
  removeCategoryFromPost,
  type Post,
} from "@/lib/actions"

const CATEGORIES = [
  { label: "Deviant Vectors", value: "deviant-vectors" },
  { label: "Etsy Products", value: "etsy-products" },
]

export default function AdminPage() {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [content, setContent] = useState("")
  const [image, setImage] = useState("")
  const [price, setPrice] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [imageDimensions, setImageDimensions] = useState<Record<string, { width: number; height: number }>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryValues, setEditingCategoryValues] = useState<string[]>([])
  const [importingCSV, setImportingCSV] = useState(false)
  const csvFileInputRef = useRef<HTMLInputElement>(null)
  const [addingCategoryId, setAddingCategoryId] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()

    const resizeObserverErr = window.console.error
    window.console.error = (...args: any[]) => {
      if (args[0]?.includes?.("ResizeObserver loop")) {
        return
      }
      resizeObserverErr(...args)
    }

    return () => {
      window.console.error = resizeObserverErr
    }
  }, [])

  const fetchPosts = async () => {
    setLoadingPosts(true)
    console.log("[v0] Client: Fetching posts...")
    const result = await getPosts()
    console.log("[v0] Client: Fetch result:", result)
    if (result.success) {
      console.log("[v0] Client: Setting posts:", result.data)
      setPosts(result.data)
    } else {
      console.log("[v0] Client: Error fetching posts:", result.error)
    }
    setLoadingPosts(false)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      console.log("[v0] Client: Image file selected:", file.name)
    }
  }

  const handleImageUpload = async () => {
    if (!imageFile) {
      setMessage("Please select an image file first")
      return
    }

    setUploadingImage(true)
    console.log("[v0] Client: Uploading image...")

    try {
      const formData = new FormData()
      formData.append("file", imageFile)

      const result = await uploadImage(formData)

      if (result.success && result.url) {
        setImage(result.url)
        setMessage("Image uploaded successfully!")
        console.log("[v0] Client: Image uploaded:", result.url)
      } else {
        setMessage(`Error uploading image: ${result.error}`)
      }
    } catch (error) {
      setMessage(`Error uploading image: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      console.log("[v0] Client: Submitting post:", { title, slug, content, image, price, categories })

      const result = await createPost({
        title,
        slug,
        content,
        image,
        price: Number.parseFloat(price),
        category: categories,
      })

      console.log("[v0] Client: Create result:", result)

      if (result.success) {
        setMessage("Post added successfully!")
        setTitle("")
        setSlug("")
        setContent("")
        setImage("")
        setPrice("")
        setCategories([])
        setImageFile(null)
        setImagePreview("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }

        setTimeout(() => {
          fetchPosts()
        }, 1000)
      } else {
        const errorMsg = result.error || "Please try again."
        setMessage(`Error adding post: ${errorMsg}`)

        if (
          errorMsg.includes("SANITY_API_WRITE_TOKEN") ||
          errorMsg.includes("authentication") ||
          errorMsg.includes("undefined")
        ) {
          setMessage(
            `${errorMsg}\n\nPlease check:\n1. SANITY_API_WRITE_TOKEN is added to your environment variables\n2. The token has write permissions in your Sanity project\n3. Check the browser console for detailed logs`,
          )
        }
      }
    } catch (error) {
      setMessage(`An error occurred: ${error instanceof Error ? error.message : "Please try again."}`)
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTitle(value)
    if (!slug) {
      setSlug(generateSlug(value))
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted = generateSlug(value)
    setSlug(formatted)
  }

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) {
      return
    }

    console.log("[v0] Client: Deleting post:", postId)
    const result = await deletePost(postId)

    if (result.success) {
      console.log("[v0] Client: Post deleted successfully")
      fetchPosts()
    } else {
      console.error("[v0] Client: Error deleting post:", result.error)
      setMessage(`Error deleting post: ${result.error}`)
    }
  }

  const handleImageLoad = (postId: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget
    setImageDimensions((prev) => ({
      ...prev,
      [postId]: {
        width: img.naturalWidth,
        height: img.naturalHeight,
      },
    }))
  }

  const handleUpdateCategory = async (postId: string) => {
    if (editingCategoryValues.length === 0) {
      setMessage("Please select at least one category")
      return
    }

    console.log("[v0] Client: Updating categories for post:", postId, "to:", editingCategoryValues)
    const result = await updatePostCategory(postId, editingCategoryValues)

    if (result.success) {
      console.log("[v0] Client: Categories updated successfully")
      setEditingCategoryId(null)
      setEditingCategoryValues([])
      fetchPosts()
    } else {
      console.error("[v0] Client: Error updating categories:", result.error)
      setMessage(`Error updating categories: ${result.error}`)
    }
  }

  const startEditingCategory = (post: Post) => {
    setEditingCategoryId(post._id)
    const categoryArray = Array.isArray(post.category) ? post.category : post.category ? [post.category] : []
    setEditingCategoryValues(categoryArray)
  }

  const cancelEditingCategory = () => {
    setEditingCategoryId(null)
    setEditingCategoryValues([])
  }

  const toggleCategory = (value: string) => {
    setCategories((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]))
  }

  const toggleEditCategory = (value: string) => {
    setEditingCategoryValues((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]))
  }

  const handleExportCSV = async () => {
    console.log("[v0] Client: Exporting posts to CSV...")
    const result = await exportPostsToCSV()

    if (result.success && result.csv) {
      // Create blob and download
      const blob = new Blob([result.csv], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sanity-posts-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setMessage(`Successfully exported ${result.csv.split("\n").length - 1} posts to CSV`)
    } else {
      setMessage(`Error exporting CSV: ${result.error}`)
    }
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportingCSV(true)
    console.log("[v0] Client: Importing posts from CSV...")

    try {
      const text = await file.text()
      const result = await importPostsFromCSV(text)

      if (result.success) {
        setMessage(
          `Successfully imported ${result.imported} post(s)` +
            (result.errors ? `\n\nErrors:\n${result.errors.join("\n")}` : ""),
        )
        fetchPosts()
      } else {
        setMessage(`Error importing CSV: ${result.error}`)
      }
    } catch (error) {
      setMessage(`Error reading CSV file: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setImportingCSV(false)
      if (csvFileInputRef.current) {
        csvFileInputRef.current.value = ""
      }
    }
  }

  const handleAddCategory = async (postId: string, category: string) => {
    console.log("[v0] Client: Adding category:", category, "to post:", postId)
    const result = await addCategoryToPost(postId, category)

    if (result.success) {
      console.log("[v0] Client: Category added successfully")
      setAddingCategoryId(null)
      fetchPosts()
      setMessage("Category added successfully!")
    } else {
      setMessage(`Error: ${result.error}`)
    }
  }

  const handleRemoveCategory = async (postId: string, category: string) => {
    if (!confirm(`Remove "${category}" category?`)) return

    console.log("[v0] Client: Removing category:", category, "from post:", postId)
    const result = await removeCategoryFromPost(postId, category)

    if (result.success) {
      console.log("[v0] Client: Category removed successfully")
      fetchPosts()
      setMessage("Category removed successfully!")
    } else {
      setMessage(`Error: ${result.error}`)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-900 to-neutral-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-neutral-100 rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-neutral-900">Admin Dashboard</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-600 rounded-lg transition"
              >
                Export CSV
              </button>
              <label className="px-4 py-2 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition cursor-pointer">
                {importingCSV ? "Importing..." : "Import CSV"}
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  disabled={importingCSV}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          <p className="text-neutral-600 mb-8">Add a new post to your Sanity CMS</p>

          {message && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                message.includes("successfully")
                  ? "bg-green-100 text-green-900 border border-green-300"
                  : "bg-red-100 text-red-900 border border-red-300"
              }`}
            >
              <div className="whitespace-pre-line">{message}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-neutral-700 mb-2">
                Post Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={handleTitleChange}
                placeholder="Enter post title"
                required
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition bg-white text-neutral-900"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-semibold text-neutral-700 mb-2">
                Slug *
              </label>
              <input
                type="text"
                id="slug"
                value={slug}
                onChange={handleSlugChange}
                placeholder="post-slug"
                required
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition bg-white text-neutral-900"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Auto-generated from title. Use lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-semibold text-neutral-700 mb-2">
                Image *
              </label>
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 py-3.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neutral-200 file:text-neutral-700 hover:file:bg-neutral-300 bg-white text-neutral-900"
                />
                {imagePreview && (
                  <div className="flex items-start gap-3">
                    <img
                      src={imagePreview || "/placeholder.svg"}
                      alt="Preview"
                      className="max-w-sm max-h-64 object-contain rounded-lg border border-neutral-200"
                    />
                    <button
                      type="button"
                      onClick={handleImageUpload}
                      disabled={uploadingImage || !imageFile}
                      className="px-4 py-2 text-white rounded-lg hover:bg-neutral-700 disabled:bg-neutral-400 font-medium text-sm transition bg-neutral-800"
                    >
                      {uploadingImage ? "Uploading..." : "Upload to Sanity"}
                    </button>
                  </div>
                )}
                {image && <p className="text-xs text-green-600 font-medium">✓ Image uploaded successfully</p>}
                <p className="text-xs text-neutral-500">
                  Select an image file and click "Upload to Sanity" before publishing the post
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Categories * (Select one or more)
              </label>
              <div className="space-y-2 p-4 border border-neutral-300 rounded-lg bg-white">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-neutral-100 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={categories.includes(cat.value)}
                      onChange={() => toggleCategory(cat.value)}
                      className="w-4 h-4 text-neutral-600 border-neutral-300 rounded focus:ring-neutral-500"
                    />
                    <span className="text-neutral-900">{cat.label}</span>
                  </label>
                ))}
              </div>
              {categories.length > 0 && (
                <p className="text-xs text-neutral-600 mt-2">
                  Selected: {categories.map((c) => CATEGORIES.find((cat) => cat.value === c)?.label).join(", ")}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-neutral-700 mb-2">
                Price *
              </label>
              <input
                type="number"
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition bg-white text-neutral-900"
              />
              <p className="text-xs text-neutral-500 mt-1">Enter the price for this post</p>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-semibold text-neutral-700 mb-2">
                Content *
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post content here..."
                required
                rows={8}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition resize-none bg-white text-neutral-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold py-3 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 disabled:hover:scale-100"
            >
              {loading ? "Publishing..." : "Publish Post"}
            </button>
          </form>
        </div>

        <div className="mt-8 bg-neutral-100 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-neutral-900">Published Posts</h2>

          {loadingPosts ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-neutral-600 border-r-transparent"></div>
              <p className="mt-2 text-neutral-600">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <p>No posts yet. Create your first post above!</p>
              <p className="text-sm mt-2">
                If you just published a post and don't see it here, check the browser console for error logs.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const categoryArray = Array.isArray(post.category)
                  ? post.category
                  : post.category
                    ? [post.category]
                    : []
                return (
                  <div
                    key={post._id}
                    className="border border-neutral-300 rounded-lg p-6 hover:shadow-md transition bg-white"
                  >
                    <div className="flex gap-4 justify-between">
                      <div className="flex gap-4 flex-1 min-w-0">
                        {post.image && (
                          <div className="flex-shrink-0">
                            <img
                              src={post.image || "/placeholder.svg"}
                              alt={post.title}
                              className="max-w-xs max-h-48 object-contain rounded-lg"
                              onLoad={(e) => handleImageLoad(post._id, e)}
                            />
                            {imageDimensions[post._id] && (
                              <p className="text-xs text-neutral-500 mt-1 text-center">
                                {imageDimensions[post._id].width} × {imageDimensions[post._id].height} px
                              </p>
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-semibold text-neutral-900 mb-1">{post.title}</h3>
                          <p className="text-sm text-neutral-600 mb-2">
                            Slug:{" "}
                            <span className="font-mono bg-neutral-100 px-2 py-1 rounded">{post.slug.current}</span>
                          </p>
                          <p className="text-neutral-700 line-clamp-2 mb-3">{post.content}</p>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {categoryArray.map((cat) => {
                              const categoryLabel = CATEGORIES.find((c) => c.value === cat)?.label || cat
                              return (
                                <div
                                  key={cat}
                                  className="flex items-center gap-1 px-3 py-1 bg-neutral-800 text-white text-sm rounded-full"
                                >
                                  <span>{categoryLabel}</span>
                                  <button
                                    onClick={() => handleRemoveCategory(post._id, cat)}
                                    className="ml-1 hover:text-red-400 transition"
                                    title="Remove category"
                                  >
                                    ×
                                  </button>
                                </div>
                              )
                            })}

                            {addingCategoryId === post._id ? (
                              <div className="flex flex-col gap-2 p-3 border border-neutral-300 rounded-lg bg-neutral-50">
                                <p className="text-sm font-semibold text-neutral-700">Add category:</p>
                                <div className="flex flex-wrap gap-2">
                                  {CATEGORIES.filter((cat) => !categoryArray.includes(cat.value)).map((cat) => (
                                    <button
                                      key={cat.value}
                                      onClick={() => handleAddCategory(post._id, cat.value)}
                                      className="px-3 py-1 text-sm bg-neutral-700 text-white rounded hover:bg-neutral-600 transition"
                                    >
                                      + {cat.label}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => setAddingCategoryId(null)}
                                  className="px-3 py-1 text-sm bg-neutral-300 text-neutral-700 rounded hover:bg-neutral-400 transition mt-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingCategoryId(post._id)}
                                className="px-3 py-1 bg-neutral-300 text-neutral-700 text-sm rounded-full hover:bg-neutral-400 transition"
                              >
                                + Add Category
                              </button>
                            )}
                          </div>
                          <span className="text-neutral-600 font-semibold">
                            ${typeof post.price === "number" ? post.price.toFixed(2) : post.price}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(post._id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm transition self-start"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
