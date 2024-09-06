document.addEventListener("DOMContentLoaded", function () {
    const fetchButton = document.getElementById('fetchButton');
    const userInput = document.getElementById('userSearch');
    const numberPhotosElem = document.getElementById('numImages');
    const imageSizeElem = document.getElementById('imageSize');

    fetchButton.addEventListener('click', function () {
        const userSearch = userInput.value;
        if (userSearch.trim() === '') {
            // Display an alert to enter a search
            alert('Please enter a search.');
            throw new Error('Empty input');
        } else {
            fetchSearch(userSearch, numberPhotosElem, imageSizeElem);
            startPolling(userSearch); // Begin polling when search is initiated
        }
    });
    // Listen for the "keypress" event on the input element
    userInput.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            // Prevent the default form submission behavior
            event.preventDefault();
            const userSearch = userInput.value;
            if (userSearch.trim() !== '') {
                fetchSearch(userSearch, numberPhotosElem, imageSizeElem);
                startPolling(userSearch); // Begin polling when search is initiated
            }
        }
    });
});

function fetchSearch(userSearch, numberPhotosElem, imageSizeElem) {
    const numImages = numberPhotosElem.value || '20';
    const size = imageSizeElem.value || '640x480';
    const searchUrl = `/flickr/${encodeURIComponent(userSearch)}?numImages=${encodeURIComponent(numImages)}&imageSize=${encodeURIComponent(size)}`;

    // Show loading indicator before starting the fetch request
    document.getElementById('loadingIndicator').style.display = 'block';
    fetch(searchUrl)
        .then(response => {
            document.getElementById('loadingIndicator').style.display = 'none';
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                // It's a JSON response
                return response.json();
            } else {
                // It's an HTML response, images were found
                window.location.href = searchUrl;
                return null; // Stop processing the response here
            }
        })
        .then(data => {
            if (data && !data.success) {
                // No images were found, server responded with JSON
                alert(data.message);
            }
        })
        .catch(error => {
            document.getElementById('loadingIndicator').style.display = 'none';
            console.error('Error:', error);
            alert('An error occurred while searching for images.');
        });
}

// Starts polling for the image processing status
function startPolling(userSearch) {
    const loadingIndicator = document.getElementById('loadingIndicator'); // Get the loading indicator element
    const pollInterval = 2000; // Interval in milliseconds
    const maxAttempts = 30;
    let attemptCount = 0;
    const polling = setInterval(() => {


        console.log(userSearch);
        loadingIndicator.style.display = 'block'; // Show the loading indicator
        fetch(`/check-image/${encodeURIComponent(userSearch)}`)
            .then(response => response.json())
            .then(data => {
                console.log(data);
                console.log('Polling data received:', data);
                if (data.success) {
                    clearInterval(polling); // Stop polling since the image is ready
                    loadingIndicator.style.display = 'none'; // Hide the loading indicator
                    window.location.href = `/display-image/${encodeURIComponent(userSearch)}`; // Navigate to the route that displays the image
                } else {
                    console.log('Still processing...'); // Or handle data.message
                    attemptCount++;
                    if (attemptCount >= maxAttempts) {
                        console.log(attemptCount);
                        clearInterval(polling);
                        loadingIndicator.style.display = 'none';

                        alert('Unable to process images at this time. Please try again later.');
                    }
                }
            })
            .catch(error => {
                console.log('Entrou aqui tbm');
                console.error('Error:', error);
                clearInterval(polling); // Stop polling due to an error
                loadingIndicator.style.display = 'none';

                alert('An error occurred while processing images.');
            });

    }, pollInterval);
}