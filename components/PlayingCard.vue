<template>
  <view class="card-visual" :class="[colorClass, sizeClass, fill ? 'card-visual--fill' : '']">
    <view class="card-visual__body">
      <view class="card-visual__corner card-visual__corner--top">
        <text class="card-visual__rank">{{ rankLabel }}</text>
        <text class="card-visual__suit">{{ suitGlyph }}</text>
      </view>
      <view class="card-visual__center">
        <text class="card-visual__center-rank">{{ rankLabel }}</text>
        <text class="card-visual__center-suit">{{ suitGlyph }}</text>
      </view>
      <view class="card-visual__corner card-visual__corner--bottom">
        <text class="card-visual__rank">{{ rankLabel }}</text>
        <text class="card-visual__suit">{{ suitGlyph }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { labelForRank } from '../utils/calc.js'

const SUIT_SYMBOLS = Object.freeze({
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
})

const SIZE_CLASS_MAP = Object.freeze({
  lg: 'card-visual--lg',
  md: 'card-visual--md',
  sm: 'card-visual--sm',
})

const VALID_SUITS = ['S', 'H', 'D', 'C']
const DEFAULT_SUIT = SUIT_SYMBOLS.S

const props = defineProps({
  card: { type: Object, required: true },
  size: { type: String, default: 'lg' },
  fill: { type: Boolean, default: false },
})

const rank = computed(() => {
  const source = props.card || {}
  const candidate = Number(source.rank ?? source.value ?? 1)
  if (Number.isFinite(candidate)) {
    if (candidate < 1) return 1
    if (candidate > 13) return 13
    return Math.round(candidate)
  }
  return 1
})

const suit = computed(() => {
  const source = props.card || {}
  const raw = String(source.suit || 'S').toUpperCase()
  return VALID_SUITS.includes(raw) ? raw : 'S'
})

const rankLabel = computed(() => labelForRank(rank.value))
const suitGlyph = computed(() => SUIT_SYMBOLS[suit.value] || DEFAULT_SUIT)
const colorClass = computed(() => (suit.value === 'H' || suit.value === 'D') ? 'card-visual--red' : 'card-visual--black')
const sizeClass = computed(() => SIZE_CLASS_MAP[props.size] || 'card-visual--lg')
</script>

<style scoped>
.card-visual {
  --card-padding: 20rpx;
  --card-border-radius: 20rpx;
  --corner-rank-size: 36rpx;
  --corner-suit-size: 28rpx;
  --center-rank-size: 60rpx;
  --center-suit-size: 32rpx;
  --center-gap: 8rpx;
  --card-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.12);
  position: relative;
  aspect-ratio: 5 / 7;
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--card-border-radius);
  background: #fff;
  border: 2rpx solid #e5e7eb;
  box-shadow: var(--card-shadow);
  overflow: hidden;
  transition: transform 120ms ease-out;
}

.card-visual::before {
  content: '';
  display: block;
  padding-top: 140%;
}

.card-visual--fill {
  height: 100%;
  aspect-ratio: 5 / 7;
}

.card-visual--fill::before {
  display: none;
}

.card-visual__body {
  position: absolute;
  inset: 0;
  padding: var(--card-padding);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #1f2937;
}

.card-visual--red .card-visual__body {
  color: #b91c1c;
}

.card-visual__corner {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  line-height: 1;
}

.card-visual__corner--bottom {
  align-items: flex-end;
}

.card-visual__rank {
  font-weight: 700;
  font-size: var(--corner-rank-size);
}

.card-visual__suit {
  font-size: var(--corner-suit-size);
}

.card-visual__center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--center-gap);
}

.card-visual__center-rank {
  font-weight: 700;
  font-size: var(--center-rank-size);
}

.card-visual__center-suit {
  font-size: var(--center-suit-size);
}

.card-visual--black .card-visual__center-suit,
.card-visual--black .card-visual__rank,
.card-visual--black .card-visual__center-rank {
  color: #111827;
}

.card-visual--red .card-visual__center-suit,
.card-visual--red .card-visual__rank,
.card-visual--red .card-visual__center-rank {
  color: #b91c1c;
}

.card-visual--lg {
  --card-padding: 26rpx;
  --card-border-radius: 22rpx;
  --corner-rank-size: 42rpx;
  --corner-suit-size: 28rpx;
  --center-rank-size: 62rpx;
  --center-suit-size: 30rpx;
  --center-gap: 6rpx;
  --card-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.12);
}

.card-visual--md {
  --card-padding: 22rpx;
  --card-border-radius: 20rpx;
  --corner-rank-size: 36rpx;
  --corner-suit-size: 24rpx;
  --center-rank-size: 50rpx;
  --center-suit-size: 28rpx;
  --center-gap: 4rpx;
}

.card-visual--sm {
  --card-padding: 14rpx;
  --card-border-radius: 16rpx;
  --corner-rank-size: 24rpx;
  --corner-suit-size: 18rpx;
  --center-rank-size: 40rpx;
  --center-suit-size: 22rpx;
  --center-gap: 3rpx;
  --card-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.16);
}
</style>
