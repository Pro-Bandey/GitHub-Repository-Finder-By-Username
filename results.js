document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    
    if (!username) {
        window.location.href = 'index.html';
        return;
    }

    // Elements
    const userContainer = $('#user-profile');
    const repoContainer = $('#repositories');
    const loader = $('#loader');
    const paginationContainer = $('#pagination');
    const sortSelect = $('#sortRepos');
    const searchInput = $('#searchRepo');
    const chartWrapper = $('#chart-wrapper');
    const warningAlert = $('#rate-limit-warning');

    let currentPage = 1;
    let totalPages = 1;
    let allReposCache = []; // Store fetched repos for client-side sorting/filtering
    let langChartInstance = null;

    // --- 1. Fetch User Profile ---
    fetch(`https://api.github.com/users/${username}`)
        .then(handleErrors)
        .then(user => {
            renderProfile(user);
        })
        .catch(err => {
            userContainer.html(`<h3 class="text-danger">User not found</h3>`);
            $('.skeleton').hide();
        });

    // --- 2. Initial Repo Fetch ---
    fetchRepos();

    // --- Functions ---

    function fetchRepos(isSearch = false, query = '') {
        showLoader();
        
        let url;
        // If searching specifically, use Search API, otherwise use User Repos API
        if (isSearch && query) {
            url = `https://api.github.com/search/repositories?q=${query}+user:${username}&sort=${sortSelect.val()}&per_page=100`;
        } else {
            // Fetching a large batch (100) to help with charts/client-side sorting for the demo
            url = `https://api.github.com/users/${username}/repos?per_page=100&page=${currentPage}&sort=${getSortParam()}`;
        }

        fetch(url)
            .then(handleErrors)
            .then(data => {
                let repos = data.items ? data.items : data; // Search API returns .items
                
                // If it's the User API (not search), we look at Link header for pagination in a real app,
                // but for this "Viewer" improvement, we stick to 100 max for the chart to work well.
                
                allReposCache = repos; // Cache for client-side operations if needed
                
                if (repos.length === 0) {
                    repoContainer.html('<p class="text-center">No repositories found.</p>');
                    chartWrapper.hide();
                } else {
                    renderRepos(repos);
                    generateChart(repos);
                }
                hideLoader();
            })
            .catch(err => {
                console.error(err);
                repoContainer.html('<p class="text-center">Error fetching repositories.</p>');
                hideLoader();
            });
    }

    function renderProfile(user) {
        const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        
        const html = `
            <img src="${user.avatar_url}" alt="Avatar" class="user-avatar mb-3">
            <h2>${user.name || user.login}</h2>
            <p class="text-muted">@${user.login}</p>
            ${user.bio ? `<p>${user.bio}</p>` : ''}
            
            <div class="d-flex justify-content-center flex-wrap mb-3 text-white-50">
                ${user.location ? `<span class="mr-3"><i class="fas fa-map-marker-alt"></i> ${user.location}</span>` : ''}
                ${user.company ? `<span class="mr-3"><i class="fas fa-building"></i> ${user.company}</span>` : ''}
                <span><i class="fas fa-calendar-alt"></i> Joined ${joinedDate}</span>
            </div>

            <div class="d-flex justify-content-center text-center">
                <div class="mx-3"><h5>${user.followers}</h5><small>Followers</small></div>
                <div class="mx-3"><h5>${user.following}</h5><small>Following</small></div>
                <div class="mx-3"><h5>${user.public_repos}</h5><small>Repos</small></div>
            </div>
            
            <div class="mt-3">
                ${user.blog ? `<a href="${user.blog.startsWith('http') ? user.blog : 'http://'+user.blog}" target="_blank" class="btn btn-sm btn-outline-info mr-2"><i class="fas fa-link"></i> Website</a>` : ''}
                <a href="${user.html_url}" target="_blank" class="btn btn-sm btn-gh-green"><i class="fab fa-github"></i> View Profile</a>
            </div>
        `;
        userContainer.html(html);
    }

    function renderRepos(repos) {
        repoContainer.html('');
        
        // Client-side Sort (if not using Search API)
        const sortType = sortSelect.val();
        if(sortType === 'stars') repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
        if(sortType === 'forks') repos.sort((a, b) => b.forks_count - a.forks_count);
        if(sortType === 'updated') repos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        if(sortType === 'created') repos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        repos.forEach(repo => {
            const updatedDate = new Date(repo.updated_at).toLocaleDateString();
            
            const card = `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <h5 class="card-title"><a href="${repo.html_url}" target="_blank" class="text-white">${repo.name}</a></h5>
                            <span class="badge badge-dark border border-secondary">${repo.visibility || 'Public'}</span>
                        </div>
                        <p class="card-text text-muted">${repo.description || 'No description provided.'}</p>
                        
                        <div class="d-flex flex-wrap align-items-center mt-3">
                            ${repo.language ? `<span class="mr-3"><i class="fas fa-circle text-warning" style="font-size:10px;"></i> ${repo.language}</span>` : ''}
                            <span class="mr-3" title="Stars"><i class="far fa-star"></i> ${repo.stargazers_count}</span>
                            <span class="mr-3" title="Forks"><i class="fas fa-code-branch"></i> ${repo.forks_count}</span>
                            <span class="mr-3" title="Open Issues"><i class="far fa-dot-circle"></i> ${repo.open_issues_count}</span>
                            <small class="text-muted ml-auto">Updated: ${updatedDate}</small>
                        </div>
                    </div>
                </div>
            `;
            repoContainer.append(card);
        });
    }

    function generateChart(repos) {
        chartWrapper.show();
        const languages = {};
        
        repos.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
            }
        });

        const ctx = document.getElementById('langChart').getContext('2d');
        
        if (langChartInstance) langChartInstance.destroy();

        langChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(languages),
                datasets: [{
                    data: Object.values(languages),
                    backgroundColor: [
                        '#f1e05a', '#e34c26', '#563d7c', '#2b7489', '#438eff','#f0941c', '#e32626', '#3f7c3d', '#892b84', '#001aff'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#fff' } },
                    title: { display: true, text: 'Top Languages', color: '#fff' }
                }
            }
        });
    }

    function handleErrors(response) {
        if (!response.ok) {
            if (response.status === 403) {
                warningAlert.show();
            }
            throw Error(response.statusText);
        }
        return response.json();
    }

    function showLoader() {
        loader.show();
        repoContainer.hide();
    }
    
    function hideLoader() {
        loader.hide();
        repoContainer.show();
    }

    function getSortParam() {
        // Map dropdown values to API sort param if needed
        return 'updated'; 
    }

    // --- Event Listeners ---
    
    // Sort Change
    sortSelect.on('change', () => {
        // Re-render based on cached data to save API calls
        if (allReposCache.length > 0) {
            renderRepos(allReposCache);
        } else {
            fetchRepos();
        }
    });

    // Search Repo (Debounce)
    let searchTimeout;
    searchInput.on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = this.value;
            if (query.length > 2) {
                // If user types, use Client filter first for speed, or Server Search
                // Here we simply re-filter the *fetched* list for instant feel
                const filtered = allReposCache.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
                renderRepos(filtered);
            } else if (query.length === 0) {
                renderRepos(allReposCache);
            }
        }, 300);
    });
});