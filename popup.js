document.getElementById('save').addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const q1 = document.getElementById('question1').value;
    const a1 = document.getElementById('answer1').value;
    const q2 = document.getElementById('question2').value;
    const a2 = document.getElementById('answer2').value;
    const q3 = document.getElementById('question3').value;
    const a3 = document.getElementById('answer3').value;

    chrome.storage.sync.set({loginDetails: {username, password, q1, a1, q2, a2, q3, a3}}, () => {
        alert('Login details saved!');
    });
});

// Load saved login details to show in the popup
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get('loginDetails', ({ loginDetails }) => {
        if (loginDetails) {
            document.getElementById('username').value = loginDetails.username || '';
            document.getElementById('password').value = loginDetails.password || '';
            document.getElementById('question1').value = loginDetails.q1 || '';
            document.getElementById('answer1').value = loginDetails.a1 || '';
            document.getElementById('question2').value = loginDetails.q2 || '';
            document.getElementById('answer2').value = loginDetails.a2 || '';
            document.getElementById('question3').value = loginDetails.q3 || '';
            document.getElementById('answer3').value = loginDetails.a3 || '';
        }
    });
});