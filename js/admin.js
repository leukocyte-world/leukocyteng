// Admin functionality for GitHub API + Quill.js WYSIWYG
document.addEventListener('DOMContentLoaded', () => {
  const navNewPost = document.getElementById('navNewPost');
  const navManagePosts = document.getElementById('navManagePosts');
  const viewWrite = document.getElementById('viewWrite');
  const viewManage = document.getElementById('viewManage');
  const btnPublish = document.getElementById('btnPublish');
  const postsTableBody = document.getElementById('postsTableBody');
  const toast = document.getElementById('adminToast');

  // GitHub Configurations
  const GITHUB_REPO = 'leukocyte-world/leukocyteng';
  let GH_PAT = localStorage.getItem('GH_PAT_KEY') || '';

  // Auth Proxy over Admin Dashboard
  if (window.location.pathname.includes('admin')) {
    const isLogged = sessionStorage.getItem('LEUKO_LOGGED');
    if (!isLogged) {
      const email = prompt("Enter Admin Email:");
      if (email !== 'leukocyteng@gmail.com') {
        alert("Unauthorized.");
        document.body.innerHTML = "<h1 style='text-align:center; margin-top:20vh;'>Access Denied</h1>";
        throw new Error("Unauthorized");
      }
      
      const pwd = prompt("Enter Admin Password:");
      if (pwd !== 'creatorops2026') {
        alert("Incorrect password.");
        document.body.innerHTML = "<h1 style='text-align:center; margin-top:20vh;'>Access Denied</h1>";
        throw new Error("Unauthorized");
      }
      
      sessionStorage.setItem('LEUKO_LOGGED', 'true');
    }

    if (!GH_PAT) {
      GH_PAT = prompt("Please enter your GitHub Personal Access Token (PAT) for GitHub backend sync:\n(This securely stores locally so you don't have to enter it again to publish blogs.)");
      if(GH_PAT) localStorage.setItem('GH_PAT_KEY', GH_PAT);
    }
  }

  // Base API caller
  async function ghAPI(path, method = 'GET', body = null) {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
      method,
      headers: {
        'Authorization': `token ${GH_PAT}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : null
    });
    return res;
  }

  // Base64 helpers
  const utf8ToBase64 = (str) => window.btoa(unescape(encodeURIComponent(str)));
  const base64ToUtf8 = (str) => decodeURIComponent(escape(window.atob(str)));

  async function fetchFileObj(path) {
    const r = await ghAPI(path);
    if(r.status === 404) return null;
    if(!r.ok) throw new Error("Failed to fetch " + path);
    return await r.json();
  }

  async function getPosts() {
    try {
      showToast('Syncing with Github...', false);
      const file = await fetchFileObj('posts.json');
      if (!file) return [];
      const content = base64ToUtf8(file.content);
      return JSON.parse(content);
    } catch(e) {
      console.error(e);
      showToast('Error syncing with Github API. Check PAT.', true);
      return [];
    }
  }

  async function savePosts(postsArray) {
    const existingFile = await fetchFileObj('posts.json');
    const sha = existingFile ? existingFile.sha : undefined;
    const res = await ghAPI('posts.json', 'PUT', {
      message: 'docs(blog): Update posts.json via Admin Dashboard',
      content: utf8ToBase64(JSON.stringify(postsArray, null, 2)),
      sha
    });
    if(!res.ok) throw new Error("Failed to push to GitHub");
    return res;
  }

  // Setup Quill Editor
  const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
    ['blockquote', 'code-block'],
    [{ 'header': 1 }, { 'header': 2 }],               // custom button values
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
    [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
    [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults
    [{ 'align': [] }],
    ['link', 'image', 'video'],
    ['clean']                                         // remove formatting
  ];

  let quill = null;
  if (document.getElementById('editor-area')) {
    quill = new Quill('#editor-area', {
      theme: 'snow',
      modules: {
        toolbar: {
          container: toolbarOptions,
          handlers: {
            image: imageHandler
          }
        }
      },
      placeholder: 'Write an epic blog post...'
    });
  }

  // Image Handler for Github API
  function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const base64Str = reader.result.split(',')[1];
        const filename = `${Date.now()}-${file.name.replace(/\\s+/g, '-')}`;
        
        showToast('Uploading image to GitHub...', false);
        try {
          const res = await ghAPI(`assets/blog-images/${filename}`, 'PUT', {
            message: `upload(blog): add image ${filename}`,
            content: base64Str
          });
          
          if (!res.ok) throw new Error("Image Upload Failed");
          
          const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/assets/blog-images/${filename}`;
          const range = quill.getSelection();
          quill.insertEmbed(range.index, 'image', rawUrl);
          showToast('Image uploaded ✅');
        } catch(e) {
          showToast('Image upload failed ❌', true);
          console.error(e);
        }
      };
      reader.readAsDataURL(file);
    };
  }

  // Navigation
  if (navNewPost) {
    navNewPost.addEventListener('click', (e) => {
      e.preventDefault();
      navManagePosts.classList.remove('active');
      navNewPost.classList.add('active');
      viewManage.style.display = 'none';
      viewWrite.style.display = 'block';
    });
  }

  if (navManagePosts) {
    navManagePosts.addEventListener('click', async (e) => {
      e.preventDefault();
      navNewPost.classList.remove('active');
      navManagePosts.classList.add('active');
      viewWrite.style.display = 'none';
      viewManage.style.display = 'block';
      await renderPostsTable();
    });
  }

  // Publish Post
  if (btnPublish) {
    btnPublish.addEventListener('click', async () => {
      const title = document.getElementById('postTitle').value.trim();
      const category = document.getElementById('postCategory').value;
      const excerpt = document.getElementById('postExcerpt').value.trim();
      const content = quill.root.innerHTML;

      if (!title || !excerpt || quill.getText().trim() === '') {
        showToast('Please fill out Title, Excerpt, and body content.', true);
        return;
      }

      if(!GH_PAT) {
        showToast('GitHub PAT missing!', true);
        return;
      }

      btnPublish.textContent = 'Publishing...';
      btnPublish.disabled = true;

      try {
        const posts = await getPosts();
        const thumbnailMatch = content.match(/<img[^>]+src="([^">]+)"/);
        const newPost = {
          id: Date.now().toString(),
          title,
          category,
          excerpt,
          content,
          thumbnail: thumbnailMatch ? thumbnailMatch[1] : '',
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        };

        posts.unshift(newPost);
        await savePosts(posts);

        showToast('Post published to GitHub successfully! ✅');
        
        // Clear form
        document.getElementById('postTitle').value = '';
        document.getElementById('postExcerpt').value = '';
        quill.root.innerHTML = '';
      } catch(e) {
        showToast('Failed to publish post.', true);
        console.error(e);
      } finally {
        btnPublish.textContent = 'Publish Post';
        btnPublish.disabled = false;
      }
    });
  }

  // Render Table
  async function renderPostsTable() {
    postsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading from GitHub...</td></tr>';
    const posts = await getPosts();
    postsTableBody.innerHTML = '';

    if (posts.length === 0) {
      postsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No posts found on GitHub.</td></tr>';
      return;
    }

    posts.forEach(post => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${post.title}</td>
        <td><span class="badge" style="margin:0; padding:4px 10px; font-size:0.75rem;">${post.category}</span></td>
        <td>${post.date}</td>
        <td>
          <button onclick="deletePost('${post.id}')" style="color: #ff4a4a; padding: 4px 8px; border: 1px solid rgba(255,74,74,0.3); border-radius: 4px; font-size: 0.8rem; background: transparent; cursor: pointer;">Delete</button>
        </td>
      `;
      postsTableBody.appendChild(tr);
    });
  }

  // Global delete
  window.deletePost = async function(id) {
    if (confirm('Are you sure you want to delete this post from GitHub?')) {
      showToast('Deleting post...', false);
      try {
        let posts = await getPosts();
        posts = posts.filter(p => p.id !== id);
        await savePosts(posts);
        await renderPostsTable();
        showToast('Post deleted successfully ✅');
      } catch(e) {
        showToast('Failed to delete post.', true);
        console.error(e);
      }
    }
  };

  // Toast
  function showToast(msg, isError = false) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.borderLeftColor = isError ? '#ff4a4a' : 'var(--green)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

});
