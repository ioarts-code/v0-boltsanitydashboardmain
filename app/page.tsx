'use client';

import { useState, useEffect, useRef } from 'react';
import { createPost, getPosts, deletePost, uploadImage, updatePostCategory, type Post } from '@/lib/actions';

const CATEGORIES = [
  { label: 'Controllers', value: 'controllers' },
  { label: 'Games', value: 'games' },
  { label: 'Swedish', value: 'swedish' },
  { label: 'Cinematic', value: 'cinematic' },
  { label: 'Music', value: 'music' },
  { label: 'Misc', value: 'misc' },
];

export default function AdminPage() {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState('');
  const [price, setPrice] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageDimensions, setImageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryValues, setEditingCategoryValues] = useState<string[]>([]);

  useEffect(() => {
    fetchPosts();
    
    const resizeObserverErr = window.console.error;
    window.console.error = (...args: any[]) => {
      if (args[0]?.includes?.('ResizeObserver loop')) {
        return;
      }
      resizeObserverErr(...args);
    };

    return () => {
      window.console.error = resizeObserverErr;
    };
  }, []);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    console.log('[v0] Client: Fetching posts...');
    const result = await getPosts();
    console.log('[v0] Client: Fetch result:', result);
    if (result.success) {
      console.log('[v0] Client: Setting posts:', result.data);
      setPosts(result.data);
    } else {
      console.log('[v0] Client: Error fetching posts:', result.error);
    }
    setLoadingPosts(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      console.log('[v0] Client: Image file selected:', file.name);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) {
      setMessage('Please select an image file first');
      return;
    }

    setUploadingImage(true);
    console.log('[v0] Client: Uploading image...');

    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      
      const result = await uploadImage(formData);
      
      if (result.success && result.url) {
        setImage(result.url);
        setMessage('Image uploaded successfully!');
        console.log('[v0] Client: Image uploaded:', result.url);
      } else {
        setMessage(`Error uploading image: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error uploading image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      console.log('[v0] Client: Submitting post:', { title, slug, content, image, price, categories });
      
      const result = await createPost({
        title,
        slug,
        content,
        image,
        price: parseFloat(price),
        category: categories,
      });

      console.log('[v0] Client: Create result:', result);

      if (result.success) {
        setMessage('Post added successfully!');
        setTitle('');
        setSlug('');
        setContent('');
        setImage('');
        setPrice('');
        setCategories([]);
        setImageFile(null);
        setImagePreview('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        setTimeout(() => {
          fetchPosts();
        }, 1000);
      } else {
        const errorMsg = result.error || 'Please try again.';
        setMessage(`Error adding post: ${errorMsg}`);
        
        if (errorMsg.includes('SANITY_API_WRITE_TOKEN') || errorMsg.includes('authentication') || errorMsg.includes('undefined')) {
          setMessage(`${errorMsg}\n\nPlease check:\n1. SANITY_API_WRITE_TOKEN is added to your environment variables\n2. The token has write permissions in your Sanity project\n3. Check the browser console for detailed logs`);
        }
      }
    } catch (error) {
      setMessage(`An error occurred: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTitle(value);
    if (!slug) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = generateSlug(value);
    setSlug(formatted);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    console.log('[v0] Client: Deleting post:', postId);
    const result = await deletePost(postId);
    
    if (result.success) {
      console.log('[v0] Client: Post deleted successfully');
      fetchPosts();
    } else {
      console.error('[v0] Client: Error deleting post:', result.error);
      setMessage(`Error deleting post: ${result.error}`);
    }
  };

  const handleImageLoad = (postId: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setImageDimensions(prev => ({
      ...prev,
      [postId]: {
        width: img.naturalWidth,
        height: img.naturalHeight
      }
    }));
  };

  const handleUpdateCategory = async (postId: string) => {
    if (editingCategoryValues.length === 0) {
      setMessage('Please select at least one category');
      return;
    }

    console.log('[v0] Client: Updating categories for post:', postId, 'to:', editingCategoryValues);
    const result = await updatePostCategory(postId, editingCategoryValues);
    
    if (result.success) {
      console.log('[v0] Client: Categories updated successfully');
      setEditingCategoryId(null);
      setEditingCategoryValues([]);
      fetchPosts();
    } else {
      console.error('[v0] Client: Error updating categories:', result.error);
      setMessage(`Error updating categories: ${result.error}`);
    }
  };

  const startEditingCategory = (post: Post) => {
    setEditingCategoryId(post._id);
    const categoryArray = Array.isArray(post.category) 
      ? post.category 
      : post.category 
        ? [post.category] 
        : [];
    setEditingCategoryValues(categoryArray);
  };

  const cancelEditingCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryValues([]);
  };

  const toggleCategory = (value: string) => {
    setCategories(prev => 
      prev.includes(value) 
        ? prev.filter(c => c !== value)
        : [...prev, value]
    );
  };

  const toggleEditCategory = (value: string) => {
    setEditingCategoryValues(prev => 
      prev.includes(value) 
        ? prev.filter(c => c !== value)
        : [...prev, value]
    );
  };

  return (
    <main className="text-xs bg-white text-white">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600 mb-8">Add a new post to your Sanity CMS</p>

          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.includes('successfully')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="whitespace-pre-line">{message}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-2">
                Post Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={handleTitleChange}
                placeholder="Enter post title"
                required
                className="w-full px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition border-slate-300 bg-slate-950 py-2"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-semibold text-slate-700 mb-2">
                Slug *
              </label>
              <input
                type="text"
                id="slug"
                value={slug}
                onChange={handleSlugChange}
                placeholder="post-slug"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-slate-950"
              />
              <p className="text-xs text-slate-500 mt-1">Auto-generated from title. Use lowercase letters, numbers, and hyphens only.</p>
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-semibold text-slate-700 mb-2">
                Image *
              </label>
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 bg-slate-950 py-3.5 text-slate-300"
                />
                {imagePreview && (
                  <div className="flex items-start gap-3">
                    <img 
                      src={imagePreview || "/placeholder.svg"} 
                      alt="Preview" 
                      className="max-w-sm max-h-64 object-contain rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={handleImageUpload}
                      disabled={uploadingImage || !imageFile}
                      className="px-4 py-2 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 font-medium text-sm transition bg-slate-700"
                    >
                      {uploadingImage ? 'Uploading...' : 'Upload to Sanity'}
                    </button>
                  </div>
                )}
                {image && (
                  <p className="text-xs text-green-600 font-medium">
                    ✓ Image uploaded successfully
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Select an image file and click "Upload to Sanity" before publishing the post
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Categories * (Select one or more)
              </label>
              <div className="space-y-2 p-4 border border-slate-300 rounded-lg bg-black text-black">
                {CATEGORIES.map((cat) => (
                  <label key={cat.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={categories.includes(cat.value)}
                      onChange={() => toggleCategory(cat.value)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-white">{cat.label}</span>
                  </label>
                ))}
              </div>
              {categories.length > 0 && (
                <p className="text-xs text-slate-600 mt-2">
                  Selected: {categories.map(c => CATEGORIES.find(cat => cat.value === c)?.label).join(', ')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-slate-700 mb-2">
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-slate-950"
              />
              <p className="text-xs text-slate-500 mt-1">Enter the price for this post</p>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-semibold text-slate-700 mb-2">
                Content *
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post content here..."
                required
                rows={8}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none bg-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full hover:bg-blue-700 disabled:bg-slate-400 font-semibold py-3 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 disabled:hover:scale-100 bg-slate-950"
            >
              {loading ? 'Publishing...' : 'Publish Post'}
            </button>
          </form>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-slate-900">Published Posts</h2>
          
          {loadingPosts ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-slate-600">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No posts yet. Create your first post above!</p>
              <p className="text-sm mt-2">If you just published a post and don't see it here, check the browser console for error logs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div 
                  key={post._id} 
                  className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition"
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
                            <p className="text-xs text-slate-500 mt-1 text-center">
                              {imageDimensions[post._id].width} × {imageDimensions[post._id].height} px
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold text-slate-900 mb-1">{post.title}</h3>
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          {editingCategoryId === post._id ? (
                            <div className="w-full space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                  <label key={cat.value} className="flex items-center gap-1 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={editingCategoryValues.includes(cat.value)}
                                      onChange={() => toggleEditCategory(cat.value)}
                                      className="w-3 h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-black">{cat.label}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleUpdateCategory(post._id)}
                                  className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditingCategory}
                                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {post.category && (Array.isArray(post.category) ? post.category.length > 0 : post.category) ? (
                                (Array.isArray(post.category) ? post.category : [post.category]).map((cat) => (
                                  <button
                                    key={cat}
                                    onClick={() => startEditingCategory(post)}
                                    className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition"
                                  >
                                    {CATEGORIES.find(c => c.value === cat)?.label || cat}
                                  </button>
                                ))
                              ) : (
                                <button
                                  onClick={() => startEditingCategory(post)}
                                  className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                                >
                                  Set Categories
                                </button>
                              )}
                              <p className="text-lg font-bold text-slate-900">
                                ${post.price.toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mb-2">
                          Slug: <span className="font-mono text-slate-600">{post.slug.current}</span>
                        </p>
                        <p className="text-slate-700 line-clamp-2">{post.content}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          Created: {new Date(post._createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(post._id)}
                      className="text-red-600 hover:text-red-800 font-medium text-sm self-start flex-shrink-0 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
