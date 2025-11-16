# System Documentation: User Account & Login Logic

This document provides a brief overview of the refactored user account system.

## 1. Account Types

The system now supports two distinct types of user accounts:

### WeChat Account (`account_type: 'weixin'`)

-   **Cross-platform**: User data and progress are tied to their WeChat account (`openid`) and can be accessed from any device where they log in with WeChat.
-   **Authentication**: Uses `wx.login()` in the小程序 to get a `code`, which is then exchanged for an `openid` in the `login` cloud function.
-   **Identifier**: `openid` is the unique identifier.

### Local Account (`account_type: 'local'`)

-   **Device-specific**: User data is tied to the device it was created on. A user cannot log into their local account from another phone or tablet.
-   **Multi-account**: A single device can host multiple local accounts (e.g., for different family members).
-   **Authentication**: Uses the device's unique ID (`plus.device.uuid` for apps, a generated UUID stored in `uni.storage` for the小程序) for authentication. The cloud function verifies that the `device_id` sent from the client matches the one stored in the database for that user.
-   **Identifier**: A system-generated `user_id` (`_id`) is the unique identifier.

## 2. Configuration

### Cloud Function `login/index.js`

To enable WeChat login, you **must** configure your小程序 `AppID` and `AppSecret`.

-   **File**: `uniCloud-aliyun/cloudfunctions/login/index.js`
-   **Action**: Find the following lines and replace the placeholder values with your actual credentials.

```javascript
// TODO: 生产环境建议通过 uni-config-center 管理密钥
const WX_APPID = 'YOUR_WX_APPID'; // 请替换为你的小程序 AppID
const WX_SECRET = 'YOUR_WX_SECRET'; // 请替换为你的小程序 AppSecret
```

For production, it is highly recommended to use `uni-config-center` to manage these secrets instead of hardcoding them.

## 3. `manifest.json` & WeChat Backend Configuration

To ensure the system works correctly, you may need to check the following configurations:

### `manifest.json`

-   **AppID Configuration**: Under `mp-weixin`, ensure your小程序 `AppID` is correctly filled in. This is crucial for `uni.login` to function.

### WeChat Official Account Platform (微信公众平台)

-   **Server Domain**: In your小程序 settings under "开发" -> "开发管理" -> "开发设置" -> "服务器域名", make sure your uniCloud service space URL is added to the `request合法域名` list. This allows the小程序 frontend to call your cloud functions.
-   **AppSecret Reset**: If you have forgotten your AppSecret, you can reset it on this platform. Remember to update the cloud function configuration after resetting.
