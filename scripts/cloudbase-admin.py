#!/usr/bin/env python3
"""Scoped CloudBase deployment helper. Credentials are supplied via --auth-dir, never Git.
Uses official Tencent Cloud TC3 APIs and CloudBase CLI device authorization endpoints.
"""
import argparse, base64, datetime, hashlib, hmac, io, json, os, pathlib, platform, time, urllib.request, zipfile
ENV = 'twentyfour-d3gpwyy2p3484bd77'
REGION = 'ap-shanghai'
OAUTH = 'https://tcb-api.cloud.tencent.com/qcloud-tcb/v1/oauth'
ROOT = pathlib.Path(__file__).resolve().parents[1]
COLLECTIONS = ['tf24_users', 'tf24_stats', 'tf24_rounds', 'tf24_sessions']

def private_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f: json.dump(data, f)

def post(url, data, headers=None):
    req = urllib.request.Request(url, data=json.dumps(data, separators=(',', ':')).encode(), headers={'Content-Type': 'application/json', **(headers or {})})
    with urllib.request.urlopen(req, timeout=45) as r: return json.load(r)

def begin(directory):
    response = post(OAUTH + '/device/code', {'client_id': 'cloudbase-toolbox'})
    if response.get('code') != 'NORMAL': raise RuntimeError(response.get('code'))
    d = response['result']; d['created_at'] = time.time()
    private_write(directory / 'device.json', d)
    print(json.dumps({'user_code': d['user_code'], 'expires_in': d['expires_in'], 'url': 'https://tcb.cloud.tencent.com/dev#/cli-auth?user_code=' + d['user_code'] + '&from=cli&flow=device'}))

def complete(directory):
    d = json.loads((directory / 'device.json').read_text())
    mac = '00:00:00:00:00:00'  # Official CLI fallback when network-interface lookup is unavailable.
    for p in pathlib.Path('/sys/class/net').glob('*/address'):
        try:
            value = p.read_text().strip()
            if value != mac: mac = value; break
        except OSError: pass
    obj = post(OAUTH + '/token', {'client_id': 'cloudbase-toolbox', 'device_code': d['device_code'], 'grant_type': 'urn:ietf:params:oauth:grant-type:device_code', 'device_info': {'mac': mac, 'os': platform.node() + '/Linux ' + platform.release(), 'hash': hashlib.md5(mac.encode()).hexdigest()}})
    r = obj.get('result') or {}
    if obj.get('code') != 'NORMAL' or r.get('error'): raise RuntimeError(r.get('error') or obj.get('code'))
    if not (r.get('tmpSecretId') or r.get('secretId')): raise RuntimeError('No credential returned')
    private_write(directory / 'credentials.json', r)
    print('Authorization saved; credentials are not printed.')

class Client:
    def __init__(self, directory): self.c = json.loads((directory / 'credentials.json').read_text())
    def call(self, action, payload, service='tcb', version='2018-06-08'):
        host = service + '.tencentcloudapi.com'; ts = int(time.time())
        date = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime('%Y-%m-%d')
        sid = self.c.get('secretId') or self.c['tmpSecretId']; secret = self.c.get('secretKey') or self.c['tmpSecretKey']
        token = self.c.get('token') or self.c['tmpToken']
        body = json.dumps(payload, separators=(',', ':'))
        sha = lambda s: hashlib.sha256(s.encode()).hexdigest()
        mac = lambda key, s: hmac.new(key, s.encode(), hashlib.sha256).digest()
        canonical = 'POST\n/\n\ncontent-type:application/json\nhost:' + host + '\n\ncontent-type;host\n' + sha(body)
        scope = date + '/' + service + '/tc3_request'
        key = mac(mac(mac(('TC3' + secret).encode(), date), service), 'tc3_request')
        signature = hmac.new(key, ('TC3-HMAC-SHA256\n' + str(ts) + '\n' + scope + '\n' + sha(canonical)).encode(), hashlib.sha256).hexdigest()
        headers = {'X-TC-Action': action, 'X-TC-Version': version, 'X-TC-Region': REGION, 'X-TC-Timestamp': str(ts), 'X-TC-Token': token, 'Authorization': 'TC3-HMAC-SHA256 Credential=' + sid + '/' + scope + ', SignedHeaders=content-type;host, Signature=' + signature}
        response = post('https://' + host, payload, headers)['Response']
        if 'Error' in response: raise RuntimeError(action + ': ' + response['Error']['Code'] + ' ' + response['Error']['Message'])
        if response.get('SCFErrorCode'): raise RuntimeError(action + ': ' + response['SCFErrorCode'] + ' ' + response.get('SCFErrorMsg', ''))
        return response
    def environment(self):
        result = self.call('DescribeEnvs', {'EnvId': ENV})
        return next(e for e in result['EnvList'] if e['EnvId'] == ENV)
    def collections(self, env):
        return self.call('ListTables', {'Tag': env['Databases'][0]['InstanceId'], 'MgoLimit': 100, 'MgoOffset': 0}, 'flexdb', '2018-11-27')

def check(client):
    env = client.environment()
    print(json.dumps({k: env.get(k) for k in ['EnvId', 'Alias', 'Region', 'Status', 'PackageId']}, ensure_ascii=False))
    print('Collections:', [r['TableName'] for r in client.collections(env).get('Tables') or []])

def deploy(client):
    env = client.environment(); existing = {t['TableName'] for t in client.collections(env).get('Tables') or []}
    for name in COLLECTIONS:
        if name not in existing: client.call('CreateTable', {'Tag': env['Databases'][0]['InstanceId'], 'TableName': name}, 'flexdb', '2018-11-27')
        client.call('ModifyDatabaseACL', {'EnvId': ENV, 'CollectionName': name, 'AclTag': 'ADMINONLY'})
        print('Collection secured:', name)
    # Include dependencies installed by npm ci in the function directory; no remote arbitrary scripts.
    folder = ROOT / 'cloudfunctions' / 'tf24'
    if not (folder / 'node_modules' / 'wx-server-sdk').exists(): raise RuntimeError('Run npm ci --ignore-scripts in cloudfunctions/tf24 first')
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as z:
        for path in folder.rglob('*'):
            if path.is_file() and '.bin' not in path.parts: z.write(path, str(path.relative_to(folder)))
    code = {'ZipFile': base64.b64encode(stream.getvalue()).decode()}
    try:
        client.call('CreateFunction', {'EnvId': ENV, 'FunctionName': 'tf24', 'Handler': 'index.main', 'Runtime': 'Nodejs18.15', 'MemorySize': 256, 'Timeout': 30, 'InstallDependency': 'FALSE', 'Code': code, 'Role': 'TCB_QcsRole', 'Description': '24点在线登录、统计与匿名排行榜'})
    except RuntimeError as e:
        if 'AlreadyExist' not in str(e) and 'FunctionNameExist' not in str(e): raise
        client.call('UpdateFunctionCode', {'EnvId': ENV, 'FunctionName': 'tf24', 'Handler': 'index.main', 'InstallDependency': 'FALSE', 'Code': code})
    print('Function deployment requested. Verify function status, WeChat association and config.json OpenAPI permissions before merging main.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['auth-begin', 'auth-complete', 'check', 'deploy'])
    parser.add_argument('--auth-dir', required=True, type=pathlib.Path)
    args = parser.parse_args()
    if args.command == 'auth-begin': begin(args.auth_dir)
    elif args.command == 'auth-complete': complete(args.auth_dir)
    elif args.command == 'check': check(Client(args.auth_dir))
    else: deploy(Client(args.auth_dir))
