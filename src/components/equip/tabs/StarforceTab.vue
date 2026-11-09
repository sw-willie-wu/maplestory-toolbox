<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { STARFORCE, type StarforceRuleKey } from '@/utils/mst/enhance/rules/starforce'
import { starforceExpectation, starforceUnsourced, type VipTier } from '@/utils/mst/enhance/starforce'
import type { EquipData } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import { clampInt, formatMeso, formatNum, formatPct, kmsNotices } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const maxStar = computed(() => STARFORCE.maxStarByLevel(props.equip.level))

/** Final star shown on the item (state.star). */
const target = computed({
  get: () => state.value.star,
  set: (v: number | string) => (state.value.star = clampInt(v, 0, maxStar.value))
})
/** Star the enhancement starts from (expectation only). */
const fromStar = ref(0)
const from = computed({
  get: () => fromStar.value,
  set: (v: number | string) => (fromStar.value = clampInt(v, 0, maxStar.value))
})

const starCatch = ref(STARFORCE.starCatch.alwaysOn)
const safeguard = ref(false)
const event = ref('')
const vip = ref<VipTier>('none')
const itemPrice = ref<number | string>('')

const sg = STARFORCE.safeguard

const expectation = computed(() => {
  if (from.value >= target.value) return null
  const price = Number(itemPrice.value)
  try {
    return starforceExpectation(props.equip.level, from.value, target.value, {
      starCatch: starCatch.value,
      safeguard: safeguard.value,
      event: event.value || null,
      vip: vip.value,
      itemPrice: itemPrice.value !== '' && Number.isFinite(price) && price > 0 ? price : undefined
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
})

const unsourced = computed(() => starforceUnsourced(props.equip, target.value))

const notices = computed(() => {
  const labels: Partial<Record<StarforceRuleKey, string>> = {
    maxStarByLevel: '星數上限',
    statTable: '屬性加成表',
    attTable: '攻擊力加成表',
    destroyReturnStar: '爆裝後回到 12 星繼續'
  }
  if (starCatch.value) labels.starCatch = `抓星星（成功率 ×${STARFORCE.starCatch.multiplier}）`
  if (props.equip.slot === 'Si') labels.usesWeaponTable = '副武器套用的加成表'
  if (event.value) labels[event.value as StarforceRuleKey] = '活動效果'
  return kmsNotices(STARFORCE.ruleSources, labels)
})
</script>

<template>
  <div class="sf-tab">
    <div class="row g-2 align-items-end">
      <div class="col-6 col-sm-3">
        <label class="form-label" for="sf-from">目前星數</label>
        <input id="sf-from" v-model.number="from" type="number" class="form-control form-control-sm" min="0"
          :max="maxStar" data-test="sf-from" />
      </div>
      <div class="col-6 col-sm-3">
        <label class="form-label" for="sf-target">目標星數（說明框）</label>
        <input id="sf-target" v-model.number="target" type="number" class="form-control form-control-sm" min="0"
          :max="maxStar" data-test="sf-target" />
      </div>
      <div class="col-12 col-sm-6 text-muted small">最多 {{ maxStar }} 星（依裝備等級）</div>
    </div>

    <div class="row g-2 mt-1">
      <div class="col-12 col-sm-6">
        <div class="form-check">
          <input id="sf-starcatch" v-model="starCatch" class="form-check-input" type="checkbox"
            :disabled="STARFORCE.starCatch.alwaysOn" data-test="sf-starcatch" />
          <label class="form-check-label" for="sf-starcatch">
            抓星星<span v-if="STARFORCE.starCatch.alwaysOn" class="text-muted">（已改為常駐套用）</span>
          </label>
        </div>
        <div class="form-check">
          <input id="sf-safeguard" v-model="safeguard" class="form-check-input" type="checkbox"
            data-test="sf-safeguard" />
          <label class="form-check-label" for="sf-safeguard">
            防爆（{{ sg.fromStar }}～{{ sg.toStar }} 星，費用 +{{ sg.costMultiplier * 100 }}%）
          </label>
        </div>
      </div>
      <div class="col-6 col-sm-3">
        <label class="form-label" for="sf-event">活動</label>
        <select id="sf-event" v-model="event" class="form-select form-select-sm" data-test="sf-event">
          <option value="">無</option>
          <option v-for="ev in STARFORCE.events" :key="ev.id" :value="ev.id">{{ ev.name }}</option>
        </select>
      </div>
      <div class="col-6 col-sm-3">
        <label class="form-label" for="sf-vip">VIP 折扣</label>
        <select id="sf-vip" v-model="vip" class="form-select form-select-sm" data-test="sf-vip">
          <option value="none">無</option>
          <option v-for="v in STARFORCE.vipDiscounts" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select>
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" for="sf-item-price">裝備單價（選填，爆裝時補裝備）</label>
        <input id="sf-item-price" v-model="itemPrice" type="number" min="0" class="form-control form-control-sm"
          placeholder="楓幣" data-test="sf-item-price" />
      </div>
    </div>

    <div class="expect mt-3" data-test="sf-expect">
      <div class="expect-title">期望值（{{ from }} → {{ target }} 星）</div>
      <div v-if="!expectation" class="text-muted">目標星數需高於目前星數</div>
      <div v-else-if="'error' in expectation" class="text-danger">{{ expectation.error }}</div>
      <dl v-else class="expect-grid">
        <dt>期望楓幣</dt>
        <dd data-test="sf-meso">{{ formatMeso(expectation.meso) }}</dd>
        <dt>期望嘗試次數</dt>
        <dd>{{ formatNum(expectation.attempts, 1) }}</dd>
        <dt>期望爆裝次數</dt>
        <dd>{{ formatNum(expectation.destroys, 3) }}</dd>
        <dt>過程中至少爆一次的機率</dt>
        <dd>{{ formatPct(expectation.pDestroyAtLeastOnce) }}</dd>
        <template v-if="expectation.totalWithItemCost !== undefined">
          <dt>含補裝備總成本</dt>
          <dd data-test="sf-total-item">{{ formatMeso(expectation.totalWithItemCost) }}</dd>
        </template>
      </dl>
      <div class="text-muted small">期望楓幣不含爆裝後補裝備的成本（填寫裝備單價才計入）。</div>
    </div>
    <div v-if="unsourced" class="text-warning small mt-2">此星數的攻擊力星力加成無資料，說明框數值可能偏低。</div>

    <SourceNotice :kms="notices" />
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';
</style>
