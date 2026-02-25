const usernameInput = document.getElementById('username');
const suggestionsList = document.getElementById('suggestions-list');
let debounceTimer;

// 1. Listen for typing in the input box
usernameInput.addEventListener('input', function() {
    const query = this.value.trim();

    // Clear existing timer to prevent API spam
    clearTimeout(debounceTimer);

    // If input is empty, hide list
    if (query.length === 0) {
        suggestionsList.style.display = 'none';
        return;
    }

    // 2. Set a new timer (Debounce: 400ms delay)
    debounceTimer = setTimeout(() => {
        fetchGitHubUsers(query);
    }, 400);
});

// 3. Fetch users from GitHub Search API
function fetchGitHubUsers(query) {
    // We limit to 5 results to keep the UI clean
    fetch(`https://api.github.com/search/users?q=${query}&per_page=5`)
        .then(response => response.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
                showSuggestions(data.items);
            } else {
                suggestionsList.style.display = 'none';
            }
        })
        .catch(err => console.error("Error fetching users:", err));
}

// 4. Render the suggestions list
function showSuggestions(users) {
    suggestionsList.innerHTML = ''; // Clear old results
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'suggestion-item';
        
        // Add avatar and username to the list item
        li.innerHTML = `
            <img src="${user.avatar_url}" alt="${user.login}" class="suggestion-avatar">
            <span>${user.login}</span>
        `;

        // Click event: fill input and hide list
        li.addEventListener('click', () => {
            usernameInput.value = user.login;
            suggestionsList.style.display = 'none';
        });

        suggestionsList.appendChild(li);
    });

    suggestionsList.style.display = 'block';
}

// 5. Hide suggestions if clicking outside the box
document.addEventListener('click', function(e) {
    if (!usernameInput.contains(e.target) && !suggestionsList.contains(e.target)) {
        suggestionsList.style.display = 'none';
    }
});

// Original function to handle the button click
function fetchRepositories() {
    const username = usernameInput.value;
    if(username) {
        window.location.href = `results.html?username=${username}`;
    } else {
        alert("Please enter a username");
    }
}