document.getElementById("loginForm").style.display = "none";

function getQueryParam(param) {
    let urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

async function getSecurityQuestion() {
    const sessionToken = getQueryParam("sessionToken");

    const jsessionid_cookie = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "fetchCookies" }, (response) => {
            if (response.jsessionid) {
                resolve(response.jsessionid);
            } else {
                reject("Failed to fetch cookies.");
            }
        });
    });

    console.log("JSESSIONID Cookie:", jsessionid_cookie.value);

    //Storing the cookie in the storage
    chrome.storage.sync.set({ jsessionid_cookie: jsessionid_cookie.value });

    // Get the login details from the storage
    const loginDetails = await new Promise((resolve, reject) => {
        chrome.storage.sync.get("loginDetails", ({ loginDetails }) => {
            if (loginDetails) {
                resolve(loginDetails);
            } else {
                reject("Failed to fetch login details.");
            }
        });
    });

    const { username: user_id } = loginDetails;
    if (!user_id || !sessionToken) {
        console.error("Required details are missing in storage, URL, or cookies.");
        return;
    }

    const url = "https://erp.iitkgp.ac.in/SSOAdministration/getSecurityQues.htm";
    const headers = {
        'Accept': 'text/plain, */*; q=0.01',
        'Accept-Language': 'en-GB,en;q=0.8',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid_cookie}`,
        'Origin': 'https://erp.iitkgp.ac.in',
        'Referer': `https://erp.iitkgp.ac.in/SSOAdministration/login.htm?sessionToken=${sessionToken}&requestedUrl=https://erp.iitkgp.ac.in/IIT_ERP3/`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': '1',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'sec-ch-ua': '"Chromium";v="124", "Brave";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"'
    };

    const data = `user_id=${user_id}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: data
    });
    const text = await response.text();
    console.log("Security Question Response:", text);
    chrome.storage.sync.set({ securityQuestion: text });
}

async function deleteExistingOTPMails() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "launchAuthFlow" }, (response) => {
            if (response.success) {
                const token = response.token;
                chrome.runtime.sendMessage({ action: "deleteOTPEmails", token: token }, (response) => {
                    if (response.success) {
                        resolve();
                    } else {
                        console.error("Failed to delete emails.");
                        reject("Failed to delete emails.");
                    }
                }
                );
            } else {
                console.error("OAuth failed.");
                reject("OAuth failed.");
            }
        }
        );
    });
}

async function sendOTP() {

    await deleteExistingOTPMails();

    const sessionToken = getQueryParam("sessionToken");
    const { loginDetails, securityQuestion } = await chrome.storage.sync.get(["loginDetails", "securityQuestion"]);
    const user_id = loginDetails.username;
    const password = loginDetails.password;
    const security_question = securityQuestion;
    const q1 = loginDetails.q1;
    const a1 = loginDetails.a1;
    const q2 = loginDetails.q2;
    const a2 = loginDetails.a2;
    const q3 = loginDetails.q3;
    const a3 = loginDetails.a3;

    console.log("Security Question:", security_question);

    let answer;
    switch (security_question) {
        case q1:
            answer = a1;
            break;
        case q2:
            answer = a2;
            break;
        case q3:
            answer = a3;
            break;
        default:
            console.error("Unknown security question:", security_question);
            return;
    }

    chrome.storage.sync.set({ answer });

    // Getting the jsessionid_cookie from the storage
    const { jsessionid_cookie } = await chrome.storage.sync.get(["jsessionid_cookie"]);

    const url = 'https://erp.iitkgp.ac.in/SSOAdministration/getEmilOTP.htm';
    const headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-GB,en;q=0.8',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid_cookie}`,
        'Origin': 'https://erp.iitkgp.ac.in',
        'Referer': `https://erp.iitkgp.ac.in/SSOAdministration/login.htm?sessionToken=${sessionToken}&requestedUrl=https://erp.iitkgp.ac.in/IIT_ERP3/`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': '1',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'sec-ch-ua': '"Chromium";v="124", "Brave";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"'
    };
    const data = `user_id=${user_id}&password=${password}&answer=${answer}&typeee=SI&email_otp=&sessionToken=${sessionToken}&requestedUrl=https%3A%2F%2Ferp.iitkgp.ac.in%2FIIT_ERP3%2F`;

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: data
    });

    const jsonResponse = await response.json();
    console.log("OTP Response:", jsonResponse);
    chrome.storage.sync.set({otpSent: true}); // Store the current time
}

async function fetchOTP() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "launchAuthFlow" }, (response) => {
            if (response.success) {
                const token = response.token;
                chrome.runtime.sendMessage({ action: "fetchEmails", token: token }, (response) => {
                    if (response.success) {
                        const otp = response.otp;
                        console.log("Extracted OTP:", otp);
                        chrome.storage.sync.set({ otp: otp }, () => {
                            resolve();
                        });
                    } else {
                        console.error("Failed to fetch emails.");
                        reject("Failed to fetch emails.");
                    }
                });
            } else {
                console.error("OAuth failed.");
                reject("OAuth failed.");
            }
        });
    });
}

async function loginWithOTP() {
    // Get user_id, password, otp, and security question answer from storage
    const { loginDetails, otp, answer } = await chrome.storage.sync.get(["loginDetails", "otp", "answer"]);
    const user_id = loginDetails.username;
    const password = loginDetails.password;

    // Get the session token from the URL
    const sessionToken = getQueryParam("sessionToken");

    // Get the jsessionid_cookie from the storage
    const { jsessionid_cookie } = await chrome.storage.sync.get(["jsessionid_cookie"]);

    const url = 'https://erp.iitkgp.ac.in/SSOAdministration/auth.htm';
    const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.6',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `JSESSIONID=${jsessionid_cookie}`,
        'Origin': 'https://erp.iitkgp.ac.in',
        'Referer': `https://erp.iitkgp.ac.in/SSOAdministration/login.htm?sessionToken=${sessionToken}&requestedUrl=https://erp.iitkgp.ac.in/IIT_ERP3/`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Sec-GPC': '1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="124", "Brave";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"'
    };

    const data = `user_id=${user_id}&password=${password}&answer=${answer}&typeee=SI&email_otp=${otp}&sessionToken=${sessionToken}&requestedUrl=https%3A%2F%2Ferp.iitkgp.ac.in%2FIIT_ERP3%2F`;

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: data
    });
    const text = await response.text();

    //Now redirect to 'https://erp.iitkgp.ac.in/IIT_ERP3/'
    window.location.href = 'https://erp.iitkgp.ac.in/IIT_ERP3/';
}

(async function () {
    await getSecurityQuestion();
    await sendOTP();
    await fetchOTP();
    await loginWithOTP();
})();