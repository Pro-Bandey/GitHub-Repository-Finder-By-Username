// --- results.js ---

// Official GitHub Language Colors
const languageColors = {
    "JavaScript": "#f1e05a",
    "Python": "#3572A5",
    "Java": "#b07219",
    "HTML": "#e34c26",
    "CSS": "#563d7c",
    "C": "#555555",
    "C++": "#f34b7d",
    "C#": "#178600",
    "TypeScript": "#2b7489",
    "PHP": "#4F5D95",
    "Ruby": "#701516",
    "Go": "#00ADD8",
    "Swift": "#F05138",
    "Kotlin": "#A97BFF",
    "Rust": "#dea584",
    "Dart": "#00B4AB",
    "Shell": "#89e051",
    "PowerShell": "#012456",
    "Vue": "#41b883",
    "R": "#198ce7",
    "Objective-C": "#438eff",
    "Scala": "#c22d40",
    "Perl": "#0298c3",
    "Lua": "#000080",
    "Haskell": "#5e5086",
    "Elixir": "#6e4a7e",
    "Clojure": "#db5855",
    "Makefile": "#427819",
    "Dockerfile": "#384d54",
    "Assembly": "#6E4C13",
    "Jupyter Notebook": "#DA5B0B"
};

// Fallback function for unknown languages
function getColorForLanguage(lang) {
    // SAFETY CHECK: If language is null or undefined, return a default gray color
    if (!lang) return '#8b949e';

    // If language exists in our map, return it
    if (languageColors[lang]) {
        return languageColors[lang];
    }

    // If not found, generate a random color based on the string
    let hash = 0;
    // We can safely read .length here because we checked (!lang) at the top
    for (let i = 0; i < lang.length; i++) {
        hash = lang.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}


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
                ${user.blog ? `<a href="${user.blog.startsWith('http') ? user.blog : 'http://' + user.blog}" target="_blank" class="btn btn-sm btn-outline-info mr-2"><i class="fas fa-link"></i> Website</a>` : ''}
                <a href="${user.html_url}" target="_blank" class="btn btn-sm btn-gh-green"><i class="fab fa-github"></i> View Profile</a>
            </div>
        `;
        userContainer.html(html);
    }

    function renderRepos(repos) {
        repoContainer.html('');

        // Client-side Sort (if not using Search API)
        const sortType = sortSelect.val();
        if (sortType === 'stars') repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
        if (sortType === 'forks') repos.sort((a, b) => b.forks_count - a.forks_count);
        if (sortType === 'updated') repos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        if (sortType === 'created') repos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        repos.forEach(repo => {
            const updatedDate = new Date(repo.updated_at).toLocaleDateString();
            const langColor = getColorForLanguage(repo.language);

            const card = `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <h5 class="card-title"><a href="${repo.html_url}" target="_blank" class="text-white">${repo.name}</a></h5>
                            <span class="badge badge-dark border border-secondary">${repo.visibility || 'Public'}</span>
                        </div>
                        <p class="card-text text-muted">${repo.description || 'No description provided.'}</p>
                        
                        <div class="d-flex flex-wrap align-items-center mt-3">
                            ${repo.language ? `<span class="mr-3"><i class="fas fa-circle" style="color:${langColor}; font-size:10px;"></i> ${repo.language}</span>` : ''}
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
        // 1. Calculate Language Counts
        const languagesCount = {};

        repos.forEach(repo => {
            if (repo.language) {
                languagesCount[repo.language] = (languagesCount[repo.language] || 0) + 1;
            }
        });

        // If no languages found, hide chart
        if (Object.keys(languagesCount).length === 0) {
            $('#chart-wrapper').hide();
            return;
        }

        $('#chart-wrapper').show();

        // 2. Prepare Data for Chart.js
        const labels = Object.keys(languagesCount);
        const dataValues = Object.values(languagesCount);

        // Map the labels to our specific colors
        const backgroundColors = labels.map(lang => getColorForLanguage(lang));

        const ctx = document.getElementById('langChart').getContext('2d');

        // Destroy previous instance if it exists to prevent overlap
        if (langChartInstance) {
            langChartInstance.destroy();
        }

        // 3. Create the Chart
        langChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: backgroundColors,
                    borderColor: '#161b22', // Match the card background for a clean cut effect
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#c9d1d9', // Light gray text for dark mode
                            font: {
                                size: 12
                            },
                            padding: 20
                        }
                    },
                    title: {
                        display: true,
                        text: 'Top Languages used in Repositories',
                        color: '#fff',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.chart._metasets[context.datasetIndex].total;
                                const percentage = Math.round((value / total) * 100) + '%';
                                return `${label}: ${value} repos (${percentage})`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
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
    searchInput.on('input', function () {
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