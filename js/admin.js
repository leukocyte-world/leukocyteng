// Admin functionality for classic editor using localStorage

document.addEventListener('DOMContentLoaded', () => {
  const navNewPost = document.getElementById('navNewPost');
  const navManagePosts = document.getElementById('navManagePosts');
  const viewWrite = document.getElementById('viewWrite');
  const viewManage = document.getElementById('viewManage');
  const btnPublish = document.getElementById('btnPublish');
  const postsTableBody = document.getElementById('postsTableBody');
  const toast = document.getElementById('adminToast');

  // Navigation
  navNewPost.addEventListener('click', (e) => {
    e.preventDefault();
    navManagePosts.classList.remove('active');
    navNewPost.classList.add('active');
    viewManage.style.display = 'none';
    viewWrite.style.display = 'block';
  });

  navManagePosts.addEventListener('click', (e) => {
    e.preventDefault();
    navNewPost.classList.remove('active');
    navManagePosts.classList.add('active');
    viewWrite.style.display = 'none';
    viewManage.style.display = 'block';
    renderPostsTable();
  });

  // DB logic (localStorage)
  const getPosts = () => JSON.parse(localStorage.getItem('leuko_blog_posts') || '[]');
  const savePosts = (posts) => localStorage.setItem('leuko_blog_posts', JSON.stringify(posts));

  // Publish Post
  btnPublish.addEventListener('click', () => {
    const title = document.getElementById('postTitle').value.trim();
    const category = document.getElementById('postCategory').value;
    const excerpt = document.getElementById('postExcerpt').value.trim();
    const content = document.getElementById('editor-area').innerHTML;

    if (!title || !excerpt || content.trim() === '' || content === '<br>') {
      showToast('Please fill out Title, Excerpt, and body content.', true);
      return;
    }

    const posts = getPosts();
    const newPost = {
      id: Date.now().toString(),
      title,
      category,
      excerpt,
      content,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    };

    posts.unshift(newPost);
    savePosts(posts);

    showToast('Post published successfully!');
    
    // Clear form
    document.getElementById('postTitle').value = '';
    document.getElementById('postExcerpt').value = '';
    document.getElementById('editor-area').innerHTML = '';
  });

  // Render Table
  function renderPostsTable() {
    const posts = getPosts();
    postsTableBody.innerHTML = '';

    if (posts.length === 0) {
      postsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No posts found.</td></tr>';
      return;
    }

    posts.forEach(post => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${post.title}</td>
        <td><span class="badge" style="margin:0; padding:4px 10px; font-size:0.75rem;">${post.category}</span></td>
        <td>${post.date}</td>
        <td>
          <button onclick="deletePost('${post.id}')" style="color: #ff4a4a; padding: 4px 8px; border: 1px solid rgba(255,74,74,0.3); border-radius: 4px; font-size: 0.8rem;">Delete</button>
        </td>
      `;
      postsTableBody.appendChild(tr);
    });
  }

  // Global delete
  window.deletePost = function(id) {
    if (confirm('Are you sure you want to delete this post?')) {
      let posts = getPosts();
      posts = posts.filter(p => p.id !== id);
      savePosts(posts);
      renderPostsTable();
      showToast('Post deleted.');
    }
  };

  // Toast
  function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.style.borderLeftColor = isError ? '#ff4a4a' : 'var(--green)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Link helper
  window.insertLink = function() {
    const url = prompt('Enter link URL:', 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  };
});
