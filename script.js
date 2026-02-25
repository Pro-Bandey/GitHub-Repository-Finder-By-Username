document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('githubForm');
    const input = document.getElementById('username');
    const autocompleteList = document.getElementById('autocomplete-list');
    const recentHistoryDiv = document.getElementById('recent-history');
    const historyBadges = document.getElementById('history-badges');

    // 1. Load Recent History
    loadHistory();

    // 2. Form Submit Handler
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = input.value.trim();
        if (username) {
            saveToHistory(username);
            window.location.href = `results.html?username=${username}`;
        }
    });

    // 3. Autocomplete with Debounce
    let timeout = null;
    input.addEventListener('input', function() {
        const query = this.value;
        autocompleteList.innerHTML = '';
        
        if (!query) return;

        clearTimeout(timeout);
        
        // Wait 500ms before making API call
        timeout = setTimeout(() => {
            fetch(`https://api.github.com/search/users?q=${query}&per_page=5`)
                .then(res => res.json())
                .then(data => {
                    autocompleteList.innerHTML = '';
                    if (data.items) {
                        data.items.forEach(user => {
                            const item = document.createElement('div');
                            item.innerHTML = `
                                <img src="${user.avatar_url}" width="20" style="border-radius:50%; margin-right:10px;">
                                <strong>${user.login}</strong>
                            `;
                            item.addEventListener('click', () => {
                                input.value = user.login;
                                autocompleteList.innerHTML = '';
                                // Optional: Auto submit on click
                                // form.dispatchEvent(new Event('submit'));
                            });
                            autocompleteList.appendChild(item);
                        });
                    }
                })
                .catch(err => console.log('Autocomplete limit reached or error'));
        }, 500);
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target !== input) {
            autocompleteList.innerHTML = '';
        }
    });

    // --- Helper Functions ---

    function saveToHistory(username) {
        let history = JSON.parse(localStorage.getItem('gh_search_history')) || [];
        // Remove if exists to push to top
        history = history.filter(u => u !== username);
        history.unshift(username);
        // Keep only last 5
        if (history.length > 5) history.pop();
        localStorage.setItem('gh_search_history', JSON.stringify(history));
    }

    function loadHistory() {
        let history = JSON.parse(localStorage.getItem('gh_search_history')) || [];
        if (history.length > 0) {
            recentHistoryDiv.style.display = 'block';
            historyBadges.innerHTML = '';
            history.forEach(user => {
                const badge = document.createElement('span');
                badge.className = 'badge badge-secondary mr-1 p-2';
                badge.style.cursor = 'pointer';
                badge.innerText = user;
                badge.onclick = () => {
                    input.value = user;
                    form.dispatchEvent(new Event('submit'));
                };
                historyBadges.appendChild(badge);
            });
        }
    }
});