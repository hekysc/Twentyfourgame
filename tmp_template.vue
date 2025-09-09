<template>
  <view class="page col" :class="{ booted }" style="padding: 24rpx; padding-top: 24rpx; gap: 24rpx; position: relative;">

    <!-- 瑜版挸澧犻悽銊﹀煕娑撳骸鍨忛�?-->
    <view class="topbar" style="display:flex; align-items:center; justify-content:space-between; gap:12rpx; background:transparent; border:none;">
      <text class="topbar-title" style="text-align:left; flex:1;">瑜版挸澧犻悽銊﹀煕閿涙{ currentUser && currentUser.name ? currentUser.name : '閺堫亪鈧�? }}</text>
      <button class="btn btn-secondary" style="padding:16rpx 20rpx; width:auto;" @click="goLogin">閸掑洦宕查悽銊﹀�?/button>
    </view>

    <!-- 閻楀苯灏敍姘磽瀵姴宕遍悧鍥╃搼鐎硅棄宕板鈥茬鐞涘矉绱欏В蹇撶炊閸楋紕澧栭崡鏇犲鐠佲剝鏆熼�?-->
    <view id="cardGrid" class="card-grid" style="padding-top: 50rpx;">
      <view v-for="(card, idx) in cards" :key="idx"
            class="card"
            :class="{ used: (usedByCard[idx]||0) > 0 }"
            @touchstart.stop.prevent="startDrag({ type: 'num', value: String(card.rank), rank: card.rank, suit: card.suit, cardIndex: idx }, $event)"
            @touchmove.stop.prevent="onDrag($event)"
            @touchend.stop.prevent="endDrag()">
        <image class="card-img" :src="cardImage(card)" mode="widthFix"/>
      </view>
    </view>

    <!-- 閺堫剙鐪紒鐔活吀閿涘牏澧濋崼?+ 閼虫粏绀嬮敍?-->
    <view class="stats-card">
      <view class="stats-row">
        <text class="stat-label">閸撯晙缍戦幍鎴濆�?/text>
        <text class="stat-value">{{ remainingCards }}</text>
      </view>
      <view class="stats-row">
        <text class="stat-label">瀹歌尙甯虹仦鈧�?/text>
        <text class="stat-value">{{ handsPlayed }}</text>
      </view>
      <view class="stats-row">
        <text class="stat-label ok">閹存劕濮?/text>
        <text class="stat-value ok">{{ successCount }}</text>
      </view>
      <view class="stats-row">
        <text class="stat-label fail">婢惰精瑙?/text>
        <text class="stat-value fail">{{ failCount }}</text>
      </view>
      <view class="stats-row">
        <text class="stat-label">閼虫粎宸?/text>
        <text class="stat-value">{{ winRate }}%</text>
      </view>
    </view>

    <!-- 鐞涖劏鎻蹇撳幢閻楀洤顔愰崳?-->
    <view class="expr-card">
      <view class="expr-title">瑜版挸澧犵悰銊ㄦ彧瀵骏绱?text class="status-text">{{ currentText ? currentText : '閺堫亜鐣幋? }}</text></view>
      <view id="exprZone" class="expr-zone" :class="{ 'expr-zone-active': drag.active }" :style="{ height: exprZoneHeight + 'px' }">
        <view v-if="tokens.length === 0" class="expr-placeholder">鐏忓棗宕遍悧灞芥嫲鏉╂劗鐣荤粭锔藉珛閸掓媽绻栭柌?/view>
        <view id="exprRow" class="row expr-row" :style="{ transform: `scale(${exprScale})`, transformOrigin: 'left center' }">
          <block v-for="(t, i) in tokens" :key="i">
            <view v-if="dragInsertIndex === i" class="insert-placeholder" :class="placeholderSizeClass"></view>
          <view class="tok" :class="[ (t.type === 'num' ? 'num' : 'op'), { 'just-inserted': i === lastInsertedIndex, 'dragging': drag.token && drag.token.type==='tok' && drag.token.index===i } ]"
                @touchstart.stop.prevent="startDrag({ type: 'tok', index: i, value: t.value }, $event)"
                @touchmove.stop.prevent="onDrag($event)"
                @touchend.stop.prevent="endDrag()">
            <image v-if="t.type==='num'" class="tok-card-img" :src="cardImage({ rank: t.rank || +t.value, suit: t.suit || 'S' })" mode="heightFix"/>
            <text v-else class="tok-op-text">{{ t.value }}</text>
          </view>
          </block>
          <view v-if="dragInsertIndex === tokens.length" class="insert-placeholder" :class="placeholderSizeClass"></view>
        </view>
      </view>
    </view>

    <!-- 鏉炵粯褰佺粈鐑樻瀮濡?-->
    <text id="hintText" class="hint-text">{{ feedback || '鐠囬鏁ら崶娑樼炊閻楀苯鎷版潻鎰暬缁楋妇鐣婚�?24' }}</text>

        <!-- 鏉╂劗鐣荤粭锕€鈧瑩鈧灏敍姘⒈鐞涘苯绔风仦鈧?-->
        <view id="opsRow1" :class="['ops-row-1', opsDensityClass]">
      <button v-for="op in ['+','-','�?,'�?]" :key="op" class="btn btn-operator"
              @touchstart.stop.prevent="startDrag({ type: 'op', value: op }, $event)"
              @touchmove.stop.prevent="onDrag($event)"
              @touchend.stop.prevent="endDrag()">{{ op }}</button>
    </view>
    <view id="opsRow2" :class="['ops-row-2', opsDensityClass]">
      <view class="ops-left">
        <button v-for="op in ['(',')']" :key="op" class="btn btn-operator"
                @touchstart.stop.prevent="startDrag({ type: 'op', value: op }, $event)"
                @touchmove.stop.prevent="onDrag($event)"
                @touchend.stop.prevent="endDrag()">{{ op }}</button>
      </view>
      <button class="btn btn-secondary mode-btn" @click="toggleFaceMode">{{ faceUseHigh ? 'J/Q/K=11/12/13' : 'J/Q/K=1' }}</button>
    </view>

    <!-- 閹锋牗瀚挎稉顓犳畱濞搭喖鐪?-->
    <view v-if="drag.active" class="drag-ghost" :style="ghostStyle">{{ ghostText }}</view>

    <!-- 閹绘劒姘?�?闁插秴鍟撻敍姘倗閸楃姳绔撮崡濠傤啍�?-->
    <view id="submitRow" class="pair-grid">
      <button class="btn btn-primary" @click="check">閹绘劒姘︾粵鏃€�?/button>
      <button class="btn btn-primary" @click="clearAll">濞撳懐鈹栫悰銊ㄦ彧�?/button>
    </view>

    <!-- 缁涙梹顢?�?閹广垽顣介敍姘毙╅崝銊ュ煂閹绘劒姘﹂崠杞扮瑓�?-->
    <view class="pair-grid">
      <button class="btn btn-secondary" @click="showSolution">缁涙梹顢?/button>
      <button class="btn btn-secondary" @click="skipHand">閹广垽顣?/button>
    </view>

    <!-- 鎼存洟鍎寸€佃壈鍩呴敍姘辩埠�?/ 濞撳憡鍨?/ 閻劍鍩?-->
    <view id="bottomBar" class="bottom-bar">
      <view class="bottom-bar-inner bottom-nav">
        <view class="bottom-item" @click="goStats">
          <text class="bottom-icon">棣冩�?/text>
          <text class="bottom-label">缂佺喕顓?/text>
        </view>
        <view class="bottom-item" @click="goGame">
          <text class="bottom-icon">棣冨�?/text>
          <text class="bottom-label">濞撳憡鍨?/text>
        </view>
        <view class="bottom-item" @click="goUser">
          <text class="bottom-icon">棣冩�?/text>
          <text class="bottom-label">閻劍鍩?/text>
        </view>
      </view>
    </view>
  </view>
</template>
