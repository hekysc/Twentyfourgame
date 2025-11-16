好，下面我帮你把这套“微信账号 + 本机普通账号”的体系，整理成一份 **可以给后端/前端/测试共用的接口文档**，并附一个 **精简版 OpenAPI 3.0 YAML** 模板，你可以直接放到 Swagger / Apifox / Postman 里。

我会按照你现在的实现思路：

* uniCloud 云函数 `login`（多场景）
* 后续可能的 `user` 相关接口（更新昵称头像等）

---

## 一、接口总览

> 说明：这里用 HTTP 风格描述，实际落地时可以对应到 uniCloud 云函数
> （例如：`uniCloud.callFunction({ name: 'login', data })`）

| 模块 | 接口                     | 方法   | 说明                         |
| -- | ---------------------- | ---- | -------------------------- |
| 认证 | `/auth/login`          | POST | 登录/创建账号（微信 / 普通 / 升级）      |
| 认证 | `/auth/refresh`        | POST | 刷新 token（可选）               |
| 用户 | `/user/profile`        | GET  | 获取当前登录用户信息                 |
| 用户 | `/user/profile`        | PUT  | 更新昵称 / 头像等                 |
| 用户 | `/user/upgrade-weixin` | POST | 普通账号升级为微信账号（若不复用 login 场景） |

下面详细定义。

---

## 二、统一约定

### 2.1 认证方式

除 `/auth/login` 外的接口，统一使用 **Bearer Token**：

* HTTP 头：`Authorization: Bearer <token>`

（在 uniCloud 中，可以把 token 放在 `event.token` 里，或者由前端手动传入）

---

### 2.2 通用响应

```jsonc
{
  "code": 0,              // 0 表示成功，非 0 表示错误
  "message": "OK",        // 错误信息或提示语
  "data": { ... }         // 具体业务数据
}
```

错误码建议示例：

| code | 含义             |
| ---- | -------------- |
| 0    | 成功             |
| 1001 | 参数错误           |
| 1002 | 未登录 / token 失效 |
| 1003 | 账号仅限本机使用       |
| 1004 | 微信登录失败         |
| 1005 | 升级冲突 / 合并失败    |
| 2001 | 服务器内部错误        |

---

### 2.3 核心数据结构：User

```jsonc
{
  "user_id": "string",
  "account_type": "weixin | local",
  "openid": "string | null",
  "unionid": "string | null",
  "device_id": "string | null",
  "nickname": "string",
  "avatar_url": "string",
  "platforms": ["mp-weixin", "app-android"],
  "created_at": 1710000000000,
  "last_login_at": 1710088888888,
  "stats": {
    "score": 100,
    "coins": 20
  }
}
```

---

## 三、接口详情

---

### 3.1 登录接口 `/auth/login`（对应云函数 login）

#### 3.1.1 请求

* Method：`POST`
* Content-Type：`application/json`

##### Body

```jsonc
{
  "scene": "mp-weixin | app | upgrade",
  "code": "string（仅 mp-weixin、upgrade 必填）",
  "deviceId": "string（仅 app 必填）",
  "user_id": "string（可选，普通账号登录或升级时使用）",
  "phone": "string（预留：手机号登录时用）",
  "platform": "mp-weixin | app-android | app-ios | app-harmony",
  "extra": {
    "nickname": "string（可选，用于app首次登录设置）",
    "avatar_url": "string（可选）",
    "gender": 0
  }
}
```

* **scene = "mp-weixin"**

  * 用于小程序微信登录
  * 必填：`code`, `platform="mp-weixin"`
* **scene = "app"**

  * 用于 App 普通账号登录 / 创建
  * 必填：`deviceId`
  * 可选：`user_id`（指定已有账号登录；如为空则可视具体设计是游客创建还是报错）
* **scene = "upgrade"**

  * 用于普通账号升级为微信账号
  * 必填：`code`, `user_id`

#### 3.1.2 响应

```jsonc
{
  "code": 0,
  "message": "OK",
  "data": {
    "token": "string",
    "user": {
      "user_id": "string",
      "account_type": "weixin",
      "openid": "string",
      "unionid": "",
      "device_id": "",
      "nickname": "小明",
      "avatar_url": "https://...",
      "platforms": ["mp-weixin"],
      "created_at": 1710000000000,
      "last_login_at": 1710088888888,
      "stats": {
        "score": 100,
        "coins": 20
      }
    }
  }
}
```

##### 可能的错误

* `code = 1001`：缺少必要参数（如 scene、code、deviceId）
* `code = 1003`：普通账号 device_id 不匹配 → “此账号仅限本机使用”
* `code = 1004`：微信登录失败（jscode2session 返回 errcode）
* `code = 1005`：升级过程出现数据合并异常

---

### 3.2 刷新 token `/auth/refresh`（可选）

如果使用 uni-id 的 `refreshToken` 或自实现，定义如下：

#### 请求

```jsonc
{
  "token": "旧 token"
}
```

#### 响应

```jsonc
{
  "code": 0,
  "message": "OK",
  "data": {
    "token": "新 token",
    "token_expired": 1710999999999
  }
}
```

---

### 3.3 获取当前用户信息 `/user/profile` (GET)

#### 请求

* Method：`GET`

* Header：

  * `Authorization: Bearer <token>`

* 无 Body

#### 响应

```jsonc
{
  "code": 0,
  "message": "OK",
  "data": {
    "user_id": "string",
    "account_type": "weixin",
    "openid": "string | null",
    "device_id": "string | null",
    "nickname": "小明",
    "avatar_url": "https://...",
    "stats": {
      "score": 100,
      "coins": 20
    }
  }
}
```

##### 错误

* `1002`：未登录 / token 失效

---

### 3.4 更新用户资料 `/user/profile` (PUT)

用于修改昵称 / 头像（普通 & 微信账号都可以用）

#### 请求

* Method：`PUT`
* Header：Bearer token

##### Body

```jsonc
{
  "nickname": "新昵称（可选）",
  "avatar_url": "新头像 URL（可选）"
}
```

> 两个字段都可选，至少一个不为空。

#### 响应

```jsonc
{
  "code": 0,
  "message": "OK",
  "data": {
    "user": {
      "user_id": "string",
      "nickname": "新昵称",
      "avatar_url": "新头像",
      "updated_at": 1710000000000
    }
  }
}
```

---

### 3.5 普通账号升级为微信账号 `/user/upgrade-weixin` (POST)

> 如果你想和 `/auth/login` 的 `scene=upgrade` 分离，可以单独设计这个接口；否则可以不单独暴露，只在前端当作 login 的一种模式调用。

#### 请求

* Method：`POST`
* Header：Bearer token（当前是普通账号）
* Body：

```jsonc
{
  "code": "wx.login 返回的 code"
}
```

#### 响应

```jsonc
{
  "code": 0,
  "message": "OK",
  "data": {
    "token": "新的微信账号 token",
    "user": {
      "user_id": "string",
      "account_type": "weixin",
      "openid": "string",
      "nickname": "微信昵称",
      "avatar_url": "微信头像",
      "stats": {
        "score": 120,
        "coins": 50
      }
    }
  }
}
```

##### 可能的错误

* `1004`：微信登录失败（code 无效等）
* `1005`：数据合并失败

---

## 四、精简版 OpenAPI 3.0 YAML 示例

你可以把下面这段放进 Swagger / Apifox 里，然后再加字段注释、示例等。

```yaml
openapi: 3.0.0
info:
  title: Account System API
  version: 1.0.0
  description: 微信账号 + 本机普通账号 统一账户体系接口

servers:
  - url: https://api.example.com

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        user_id:
          type: string
        account_type:
          type: string
          enum: [weixin, local]
        openid:
          type: string
          nullable: true
        unionid:
          type: string
          nullable: true
        device_id:
          type: string
          nullable: true
        nickname:
          type: string
        avatar_url:
          type: string
        platforms:
          type: array
          items:
            type: string
        created_at:
          type: integer
          format: int64
        last_login_at:
          type: integer
          format: int64
        stats:
          type: object
          properties:
            score:
              type: integer
            coins:
              type: integer

    LoginRequest:
      type: object
      properties:
        scene:
          type: string
          enum: [mp-weixin, app, upgrade]
        code:
          type: string
        deviceId:
          type: string
        user_id:
          type: string
        phone:
          type: string
        platform:
          type: string
        extra:
          type: object
          properties:
            nickname:
              type: string
            avatar_url:
              type: string
            gender:
              type: integer
      required:
        - scene

    LoginResponse:
      type: object
      properties:
        token:
          type: string
        user:
          $ref: '#/components/schemas/User'

    ApiResponse:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
        data:
          type: object

paths:
  /auth/login:
    post:
      summary: 登录/创建账号（微信 / 普通 / 升级）
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: 登录结果
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/LoginResponse'

  /user/profile:
    get:
      summary: 获取当前登录用户信息
      security:
        - BearerAuth: []
      responses:
        '200':
          description: 用户信息
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/User'

    put:
      summary: 更新当前用户资料
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                nickname:
                  type: string
                avatar_url:
                  type: string
      responses:
        '200':
          description: 更新后的用户信息
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResponse'

  /user/upgrade-weixin:
    post:
      summary: 普通账号升级为微信账号
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                code:
                  type: string
              required:
                - code
      responses:
        '200':
          description: 升级结果
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/LoginResponse'
```

---

如果你愿意，我还可以**按 uniCloud 的云函数风格**，再生成一版“云函数接口文档”（比如：`login.main(event)` 的字段规范、`user.main(event)` 的 action 分发规范），这样你可以直接贴到项目 README 里当后端说明书。
