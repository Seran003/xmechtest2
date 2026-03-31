const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

const SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/Sites.Read.All',
  'https://graph.microsoft.com/Files.ReadWrite.All',
];

async function getAuthUrl() {
  return await msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: process.env.REDIRECT_URI,
  });
}

async function getTokenFromCode(code) {
  return await msalClient.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: process.env.REDIRECT_URI,
  });
}

module.exports = { msalClient, getAuthUrl, getTokenFromCode, SCOPES };
