chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension Installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "launchAuthFlow") {
    // Check if the token is already stored and valid
    chrome.storage.sync.get(["token", "tokenExpiry"], (result) => {
      const currentTime = Date.now();
      if (result.token && result.tokenExpiry && currentTime < result.tokenExpiry) {
        // Token is valid, use the stored token
        console.log("Using stored token:", result.token);
        console.log("Token expiry:", result.tokenExpiry);
        console.log("Current time:", currentTime);
        sendResponse({ success: true, token: result.token });
      } else {
        // Token is expired or not found, launch OAuth flow
        console.log("Launching OAuth flow...");
        chrome.identity.launchWebAuthFlow(
          {
            url: "https://accounts.google.com/o/oauth2/auth?client_id=46039633728-c5q4jkfatl3hfjcsrop2rje8j8etj1u5.apps.googleusercontent.com&response_type=token&redirect_uri=https://jodfpbpjkobefiiikdagijgfjpaogdcf.chromiumapp.org/&scope=https://www.googleapis.com/auth/gmail.modify",
            interactive: true
          },
          (redirectUrl) => {
            if (chrome.runtime.lastError || !redirectUrl) {
              console.error("Authentication failed: " + chrome.runtime.lastError.message);
              sendResponse({ success: false });
              return;
            }

            const token = new URL(redirectUrl).hash.split("&")[0].split("=")[1];
            const tokenExpiry = Date.now() + 3600 * 1000; // Assuming the token expires in 1 hour

            // Store the token and its expiry time
            chrome.storage.sync.set({ token, tokenExpiry }, () => {
              sendResponse({ success: true, token: token });
            });
          }
        );

        // Return true to indicate that the response will be sent asynchronously
        return true;
      }
    });

    // Return true to indicate that the response will be sent asynchronously
    return true;
  } else if (request.action === "fetchEmails") {
    const token = request.token;
    const startTime = Date.now();
    const timeout = 1 * 60 * 1000; // 1 minute
    const delay = 500; // 1 second

    async function fetchEmailsWithRetry() {
      while (Date.now() - startTime < timeout) {
        console.log("Fetching emails with token:", token);
        try {
          const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages?q=subject:OTP for Sign In in ERP Portal of IIT Kharagpur is", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            for (const message of data.messages) {
              const messageId = message.id;
              console.log("Fetching email with ID:", messageId);
              const messageResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
                headers: {
                  "Authorization": `Bearer ${token}`
                }
              });
              const messageData = await messageResponse.json();

              console.log("Message data:", messageData);

              console.log("Email received after OTP request:", messageData);
              const subjectHeader = messageData.payload.headers.find(header => header.name === "Subject");
              if (subjectHeader && subjectHeader.value.startsWith("OTP for Sign In in ERP Portal of IIT Kharagpur is")) {
                const otp = subjectHeader.value.match(/\d{6}/)[0]; // Extract the OTP from the subject
                sendResponse({ success: true, otp: otp });

                // Delete the email after extracting the OTP
                await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
                  method: 'POST',
                  headers: {
                    "Authorization": `Bearer ${token}`
                  }
                });
                console.log("Email deleted successfully.");
                return;
              }
            }
          }
        } catch (error) {
          console.error("Error fetching emails:", error);
        }

        console.log("Retrying in 1 second...");
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.error("Failed to fetch OTP within the timeout period.");
      sendResponse({ success: false });
    }

    fetchEmailsWithRetry();
    // Return true to indicate that the response will be sent asynchronously
    return true;
  } else if (request.action === "fetchCookies") {
    chrome.cookies.getAll({ domain: "erp.iitkgp.ac.in" }, function(cookies) {
      console.log(cookies);
      const ssoTokenCookie = cookies.find(cookie => cookie.name === "ssoToken");
      if (ssoTokenCookie) {
        sendResponse({ jsessionid: null });
      } else {
        const pathCookies = cookies.filter(cookie => cookie.path && cookie.path.startsWith('/SSOAdministration'));
        sendResponse({ jsessionid: pathCookies[0] });
      }
    });
    return true;
  } else if (request.action === "deleteOTPEmails") {
    //Deletes all the existing OTP emails from the inbox (if there are any)

    const token = request.token;

    async function deleteEmailsWithRetry() {
      console.log("Deleting all OTP emails");
      const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages?q=subject:OTP for Sign In in ERP Portal of IIT Kharagpur is", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.messages && data.messages.length > 0) {
        for (const message of data.messages) {
          const messageId = message.id;
          console.log("Deleting email with ID:", messageId);
          await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
            method: 'POST',
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          console.log("Email deleted successfully.");
        }
      }
      sendResponse({ success: true });
    }

    deleteEmailsWithRetry();

    return true;
  }
});
