<template>
  <div class="rune_force">
    <div class="row g-2">
      <div v-for="symbol in [arc, aut]" :key="symbol" class="col-12">
        <div class="row g-2">
          <div v-for="area in symbol" :key="area" class="col-12 col-md-6 col-xl-4">
            <div class="card custom-card">
              <div class="card-content">
                <img :src="require(`../assets/img/${area.symbol.toLowerCase()}-symbol-${area.nameEn}.png`)">
                <b>&nbsp;&nbsp;{{ area.name }}</b>
                <hr>
                <form>
                  <div class="row gy-2 align-items-center">
                    <label class="col-4 col-form-label">目前等級：</label>
                    <div class="col-3">
                      <select v-model="area.level" number class="form-control-sm mid">
                        <option v-for="lv in area.maxLevel + 1" :key="lv" :value="lv - 1">
                          {{ lv - 1 }}
                        </option>
                      </select>
                    </div>
                    <div class="col-5" />
                    <label class="col-4 col-form-label">成長值：</label>
                    <div class="col-3">
                      <input v-if="[0, area.maxLevel].includes(area.level)" :value="area.level === 0 ? 0 : 'Max'"
                        class="form-control-sm mid" disabled>
                      <input v-else v-model="area.stack" class="form-control-sm mid" number @change="area.checkStack()">
                    </div>
                    <label class="col-5 col-form-label">
                      {{ [0, area.maxLevel].includes(area.level) ? '' : `/ ${area.runeNeedList[area.level - 1]}` }}
                    </label>
                    <label class="col-4 col-form-label">每周任務：</label>
                    <div class="col-3">
                      <select v-model="area.partyGain" number class="form-control-sm mid">
                        <option v-for="num in area.maxPartyGain + 1" :key="num" :value="num - 1">
                          {{ num - 1 }}
                        </option>
                      </select>
                    </div>
                    <div class="col-5">
                      <img v-if="area.isCoin === true" :src="require(`../assets/img/${area.nameEn}-coin.png`)">
                    </div>
                    <div class="col-5">
                      <input type="checkbox" :id="area.nameEn" v-model="area.isDaily">
                      <label :for="area.nameEn">&nbsp;&nbsp;每日：{{ area.maxDailyGain + area.bonusGain }}</label>
                    </div>
                    <div v-if="area.bonusArea != null" class="col-7">
                      <input type="checkbox" :id="area.bonusArea" v-model="area.isBonus">
                      <label :for="area.bonusArea">&nbsp;&nbsp;完成{{ area.bonusArea }}</label>
                    </div>
                    <div v-if="area.partyName != null" class="col-12">
                      <input type="checkbox" :id="area.partyName" v-model="area.isParty">
                      <label :for="area.partyName">&nbsp;&nbsp;完成{{ area.partyName }}</label>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <form class="align-items-center">
              <label class="col-5">所屬職業：</label>
              <select class="form-control-sm mid" v-model="job">
                <option value="normal">一般職業</option>
                <option value="demon">惡魔復仇者</option>
                <option value="xenon">傑諾</option>
              </select>
            </form>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <form>
              <div class="row gy-0">
                <label class="col-5 col-form-label">極限屬性：</label>
                <div class="col-7">
                  <select class="form-control-sm mid" v-model="hyper">
                    <option v-for="lv in 16" :key="lv" :value="lv - 1">{{ lv - 1 }}</option>
                  </select>
                </div>
                <label class="col-5 col-form-label">公會技能：</label>
                <div class="col-7">
                  <select class="form-control-sm mid" v-model="guild">
                    <option v-for="lv in 5" :key="lv" :value="lv - 1">{{ lv - 1 }}</option>
                  </select>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <label class="col-12">全部完成日期：</label>
            <label class="col-12 text-center">
              <h3>{{ Math.max(...totalDayNeed) }} 天</h3>
            </label>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <label class="col-12">總共需要楓幣：</label>
            <label class="col-12 text-center">
              <h3>{{ moneyFormatter(totalMoneyNeed.reduce((a, b) => a + b)) }} 元</h3>
            </label>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <label class="col-12">ARC值：</label>
            <label class="col-12 text-center">
              <h3>{{ Object.values(arc).reduce((a, b) => { return a + b.forceValue }, 0) + hyperAdd + guildAdd }}
                <span class="small-font"> / {{ forceMax(arc) + hyperAdd + guildAdd }}</span>
              </h3>
            </label>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <label class="col-12">AUT值：</label>
            <label class="col-12 text-center">
              <h3>{{ Object.values(aut).reduce((a, b) => { return a + b.forceValue }, 0) }}
                <span class="small-font"> / {{ forceMax(aut) }}</span>
              </h3>
            </label>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <label class="col-12">ARC加成({{ addValueName[job] }})：</label>
            <label class="col-12 text-center">
              <h3>+{{ Object.values(arc).reduce((a, b) => { return a + b.checkJob(job) }, 0) }} </h3>
            </label>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card custom-card">
          <div class="card-content short">
            <label class="col-12">AUT加成({{ addValueName[job] }})：</label>
            <label class="col-12 text-center">
              <h3>+{{ Object.values(aut).reduce((a, b) => { return a + b.checkJob(job) }, 0) }} </h3>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Rune } from '../components/mst/rune.js'
import runeData from '../assets/db/rune.json'

const arc = reactive({})
const aut = reactive({})
const hyper = ref(0)
const guild = ref(4)
const job = ref('normal')
const addValueName = reactive({
  normal: '主屬',
  demon: '血量',
  xenon: '三屬'
})

arc.area1 = new Rune(runeData.arc1)
arc.area2 = new Rune(runeData.arc2)
arc.area3 = new Rune(runeData.arc3)
arc.area4 = new Rune(runeData.arc4)
arc.area5 = new Rune(runeData.arc5)
arc.area6 = new Rune(runeData.arc6)
aut.area1 = new Rune(runeData.aut1)
aut.area2 = new Rune(runeData.aut2)
aut.area3 = new Rune(runeData.aut3)

const totalDayNeed = computed(() => Object.values(arc).map(x => x.dayNeed).concat(Object.values(aut).map(x => x.dayNeed)))
const totalMoneyNeed = computed(() => Object.values(arc).map(x => x.moneyNeed).concat(Object.values(aut).map(x => x.moneyNeed)))

const hyperAdd = computed(() => hyper.value <= 10 ? hyper.value * 5 : 50 + (hyper.value - 10) * 10)
const guildAdd = computed(() => guild.value === 0 ? 0 : 10 + guild.value * 5)

const forceMax = rune => Object.values(rune).filter(x => x.level !== 0).reduce((a, b) => { return a + b.calculateForceValue(b.maxLevel) }, 0)

// 把楓幣單位化
const moneyFormatter = money => {
  const unit = ['', '萬', '億', '兆']
  const size = money > 0 ? Math.floor(Math.log(money) / Math.log(10000)) : 0
  money = money.toString()
  let tmp = ''
  for (let i = size; i >= 1; i--) {
    tmp += money.slice(-4 * (i + 1), -4 * (i)) + unit[i] + ' '
  }
  return size > 0 ? tmp : money
}

</script>

<style scoped lang="scss">
.form-control-sm {
  border: 1px solid rgba(0, 0, 0, 0.2);

  &.mid {
    width: 100%;
  }
}

.short {
  height: 95px;
}

.small-font {
  font-size: 16px;
}
</style>
