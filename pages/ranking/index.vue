<template>
  <view class="rank-page"
    ><AppNavBar title="排行榜" :show-back="true" />
    <view class="body"
      ><text class="kicker">一起挑战 24</text
      ><text class="heading">每一次进步，都算数</text>
      <view class="tabs"
        ><button
          v-for="m in metrics"
          :key="m.key"
          :class="{ active: metric === m.key }"
          @tap="selectMetric(m.key)"
        >
          {{ m.name }}
        </button></view
      >
      <view class="period"
        ><button
          :class="{ selected: period === 'all' }"
          @tap="selectPeriod('all')"
        >
          总榜</button
        ><button
          :class="{ selected: period === 'week' }"
          @tap="selectPeriod('week')"
        >
          本周榜
        </button></view
      >
      <text class="rule">{{
        metric === 'rate'
          ? '完成满13题参与排名；跳过、看答案计失败。'
          : '成功答对1题即可上榜，取最快自动计时成绩。'
      }}</text>
      <text class="rule">{{
        period === 'week'
          ? '北京时间周一 00:00 开始新一周。'
          : '连续7天无新成绩暂退榜；完成1题恢复。'
      }}</text>
      <view v-if="!online" class="empty"
        >登录微信帐号后查看在线排名。<button @tap="login">
          微信登录
        </button></view
      >
      <view v-else-if="loading" class="empty">正在读取排名…</view
      ><view v-else-if="error" class="empty"
        >{{ error }}<button @tap="load">重试</button></view
      >
      <view v-else class="list"
        ><view class="row head"
          ><text>名次</text><text class="name">玩家</text
          ><text>成绩</text></view
        >
        <view
          v-for="(r, i) in rows"
          :key="i"
          class="row"
          :class="{ mine: r.isMe }"
          ><text class="position">{{ r.rank }}</text
          ><text class="name">{{ r.name }}{{ r.isMe ? '（我）' : '' }}</text
          ><view class="score"
            ><text>{{ score(r) }}</text
            ><text class="count">{{ r.total }} 题</text></view
          ></view
        ><view v-if="!rows.length" class="empty"
          >暂无符合条件的成绩，来完成第一轮挑战。</view
        ></view
      > </view
    ><view v-if="online && me && !loading && !error" class="own"
      ><text>我的名次：{{ me.rank || '未上榜' }}</text
      ><text class="own-name">{{ me.name }}</text
      ><text>{{ score(me) }}</text
      ><text v-if="me.reason" class="reason">{{ me.reason }}</text></view
    >
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import AppNavBar from '../../components/AppNavBar.vue'
import { isOnline } from '../../utils/identity.js'
import { cloudCall } from '../../utils/online.js'
const metrics = [
  { key: 'rate', name: '成功率' },
  { key: 'time', name: '最快时间' },
]
const metric = ref('rate'),
  period = ref('all'),
  online = ref(isOnline()),
  rows = ref([]),
  me = ref(null),
  loading = ref(false),
  error = ref('')
let request = 0
function score(r) {
  return metric.value === 'rate'
    ? (100 * r.rate).toFixed(2) + '%'
    : r.bestTimeMs == null
      ? '—'
      : (r.bestTimeMs / 1000).toFixed(3) + ' 秒'
}
async function load() {
  online.value = isOnline()
  if (!online.value) return
  const id = ++request
  loading.value = true
  error.value = ''
  try {
    const r = await cloudCall('leaderboard', {
      metric: metric.value,
      period: period.value,
    })
    if (id !== request) return
    rows.value = r.rows
    me.value = r.me
  } catch (e) {
    if (id === request) error.value = e.message
  } finally {
    if (id === request) loading.value = false
    uni.stopPullDownRefresh()
  }
}
function selectMetric(v) {
  metric.value = v
  load()
}
function selectPeriod(v) {
  period.value = v
  load()
}
function login() {
  uni.reLaunch({ url: '/pages/login/index' })
}
onShow(load)
onPullDownRefresh(load)
</script>
<style scoped>
.rank-page {
  min-height: 100vh;
  background: #f7f3e8;
  color: #253c34;
}
.body {
  padding: 36rpx 32rpx 240rpx;
}
.kicker {
  display: block;
  font-size: 24rpx;
  color: #947747;
}
.heading {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  margin: 12rpx 0 30rpx;
}
.tabs,
.period {
  display: flex;
  gap: 12rpx;
  margin: 20rpx 0;
}
.tabs button,
.period button {
  flex: 1;
  margin: 0;
  font-size: 28rpx;
  border-radius: 16rpx;
  background: #ebece1;
  color: #52685b;
}
.tabs .active {
  background: #275c48;
  color: white;
}
.period .selected {
  background: #dccba1;
  color: #443d25;
}
.rule {
  display: block;
  font-size: 23rpx;
  color: #738077;
  line-height: 1.8;
}
.list {
  background: #fffdf6;
  border-radius: 24rpx;
  margin-top: 26rpx;
  padding: 0 22rpx;
}
.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #e8e6db;
}
.head {
  font-size: 23rpx;
  color: #738077;
}
.position {
  width: 60rpx;
  font-weight: 700;
}
.name {
  flex: 1;
  overflow: hidden;
  word-break: break-all;
}
.score {
  text-align: right;
}
.count {
  display: block;
  font-size: 21rpx;
  color: #738077;
  margin-top: 6rpx;
}
.mine {
  color: #24715c;
  font-weight: 700;
}
.empty {
  padding: 60rpx 20rpx;
  text-align: center;
  line-height: 1.8;
  color: #738077;
}
.own {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #275c48;
  color: white;
  display: flex;
  gap: 20rpx;
  flex-wrap: wrap;
  font-size: 26rpx;
}
.own-name {
  flex: 1;
  word-break: break-all;
}
.reason {
  width: 100%;
  color: #d5e4d6;
  font-size: 23rpx;
}
</style>
