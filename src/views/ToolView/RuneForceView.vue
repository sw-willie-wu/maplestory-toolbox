<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Rune } from '@/utils/mst/rune'
import runeData from '@/assets/data/rune.json'

const arc = reactive({
  area1: new Rune(runeData.arc1),
  area2: new Rune(runeData.arc2),
  area3: new Rune(runeData.arc3),
  area4: new Rune(runeData.arc4),
  area5: new Rune(runeData.arc5),
  area6: new Rune(runeData.arc6)
})
const aut = reactive({
  area1: new Rune(runeData.aut1),
  area2: new Rune(runeData.aut2),
  area3: new Rune(runeData.aut3),
  area4: new Rune(runeData.aut4),
  area5: new Rune(runeData.aut5),
  area6: new Rune(runeData.aut6)
})

const isARC = ref(true)
const hyperLevel = ref<number>(0)
const guildLevel = ref<number>(0)
const job = ref<string>('normal')

const hyperRuneLevelAdd = computed(() => hyperLevel.value <= 10 ? hyperLevel.value * 5 : 50 + (hyperLevel.value - 10) * 10)
const guilRuneLeveldAdd = computed(() => guildLevel.value === 0 ? 0 : 10 + guildLevel.value * 5)
const eventRuneLevelAdd = ref<number>(0)

const runeLevelCurrent = (rune: object) => Object.values(rune).reduce((a, b) => { return a + b.calculateForceValue(b.level) }, 0)
const runeLevelMax = (rune: object) => Object.values(rune).filter(x => x.level !== 0).reduce((a, b) => { return a + b.calculateForceValue(b.maxLevel) }, 0)
const runePowerAdd = (rune: object, job: string) => {
  let powerAdd: number = 0
  if (job === 'normal') {
    powerAdd = Object.values(rune).reduce((a, b) => { return a + b.normalAdd }, 0)
  } else if (job === 'demon') {
    powerAdd = Object.values(rune).reduce((a, b) => { return a + b.demonAdd }, 0)
  } else if (job === 'xenon') {
    powerAdd = Object.values(rune).reduce((a, b) => { return a + b.xenonAdd }, 0)
  } else { 0 }
  return powerAdd
}
const runeDayNeed = (rune: object) => Math.max(...Object.values(rune).map(x => x.dayNeed))
const dayFormatter = (day: number) => day === Infinity ? '不做每日還想逃課阿' : `${day}天`
const runeMoneyNeed = (rune: object) => Object.values(rune).reduce((a, b) => { return a + b.moneyNeed }, 0)
const moneyFormatter = (money: number) => {
  const unit = ['', '萬', '億', '兆']
  const moneyStr = money.toString()
  const size = money > 0 ? Math.floor(Math.log(money) / Math.log(10000)) : 0
  let moneyNeed: string = ''
  for (let i = size; i >= 1; i--) {
    moneyNeed += moneyStr.slice(-4 * (i + 1), -4 * (i)) + unit[i] + ' '
  }
  return size > 0 ? moneyNeed : moneyStr
}

const arcCurrentLevel = computed(() => runeLevelCurrent(arc) + hyperRuneLevelAdd.value + guilRuneLeveldAdd.value + eventRuneLevelAdd.value)
const arcMaxLevel = computed(() => runeLevelMax(arc) + hyperRuneLevelAdd.value + guilRuneLeveldAdd.value + eventRuneLevelAdd.value)
const arcCurrentAdd = computed(() => runePowerAdd(arc, job.value))
const arcMoneyNeed = computed(() => moneyFormatter(runeMoneyNeed(arc)))

const autCurrentLevel = computed(() => runeLevelCurrent(aut) + eventRuneLevelAdd.value)
const autMaxLevel = computed(() => runeLevelMax(aut) + eventRuneLevelAdd.value)
const autCurrentAdd = computed(() => runePowerAdd(aut, job.value))
const autMoneyNeed = computed(() => moneyFormatter(runeMoneyNeed(aut)))


</script>

<template>
  <div>
    <ul class="nav nav-tabs">
      <li class="nav-item">
        <a class="nav-link" :class="{ active: isARC }" @click="isARC = true">祕法符文ARC</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" :class="{ active: !isARC }" @click="isARC = false">真實符文AUT</a>
      </li>
    </ul>
    <div class="row g-2">
      <div class="col-12 gy-4"></div>
      <div v-for="area in isARC ? arc : aut" class="col-12 col-md-6 col-xl-4">
        <div class="card">
          <div class="card-content">
            <img :src="`https://maplestory-toolbox-api.vercel.app/icon/${area.id}`" class="icon">
            <b>{{ area.name }}</b>
            <hr>
            <div class="row align-items-center g-0">
              <div class="col-4 col-sm-3">
                <label class="col-form-label center">成長等級：</label>
              </div>
              <div class="col-3">
                <select v-model="area.level" number class="form-control form-control-sm">
                  <option v-for="lv in area.maxLevel + 1" :key="lv" :value="lv - 1">
                    {{ lv - 1 }}
                  </option>
                </select>
              </div>
              <div class="w-100"></div>
              <div class="col-4 col-sm-3">
                <label class="col-form-label">成長值：</label>
              </div>
              <div class="col-3">
                <input class="form-control form-control-sm" v-model.number="area.stack" type="number">
              </div>
              <div class="col-5">
                <span class="hint-text">/ {{ area.currentMaxStack }}</span>
              </div>
              <div class="col-12 mt-2">
                <input type="checkbox" class="form-check-input" v-model="area.doDaily">
                <label class="form-check-label label-text">每日任務：{{ area.dailyGain }}</label>
              </div>
              <div class="col-12 mt-1">
                <input type="checkbox" class="form-check-input" :disabled="area.partyName === null"
                  v-model="area.doParty">
                <label class="form-check-label label-text">每周任務：{{ area.partyGain }}</label>
              </div>
              <div class="col-12 mt-1">
                <input type="checkbox" class="form-check-input" :disabled="area.bonusArea === null"
                  v-model="area.doBonus">
                <label class="form-check-label label-text">額外地區：{{ area.bonusGain }}</label>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row align-items-center g-0">
              <div class="col-4">
                <label>所屬職業：</label>
              </div>
              <div class="col-8">
                <select class="form-control form-control-sm" v-model="job">
                  <option value='normal'>一般職業</option>
                  <option value='demon'>惡魔復仇者</option>
                  <option value='xenon'>傑諾</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row align-items-center g-0">
              <div class="col-4">
                <label>極限屬性：</label>
              </div>
              <div class="col-8">
                <select class="form-control form-control-sm" v-model="hyperLevel" :disabled="!isARC">
                  <option v-for="lv in 16" :key="lv" :value="lv - 1">{{ lv - 1 }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row align-items-center g-0">
              <div class="col-4">
                <label>公會技能：</label>
              </div>
              <div class="col-8">
                <select class="form-control form-control-sm" v-model="guildLevel" :disabled="!isARC">
                  <option v-for="lv in 5" :key="lv" :value="lv - 1">{{ lv - 1 }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row align-items-center g-0">
              <div class="col-4">
                <label>活動加成：</label>
              </div>
              <div class="col-8">
                <input class="form-control form-control-sm" v-model.number="eventRuneLevelAdd" type="number">
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row g-0">
              <div class="col-12">
                <span>全部升滿所需時間：</span>
              </div>
              <div class="col-12 text-center">
                <span class="enhance-text">{{ isARC ? dayFormatter(runeDayNeed(arc)) : dayFormatter(runeDayNeed(aut))
                  }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row g-0">
              <div class="col-12">
                <span>升滿所需楓幣：</span>
              </div>
              <div class="col-12 text-center">
                <span class="enhance-text">{{ isARC ? arcMoneyNeed : autMoneyNeed }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row g-0">
              <div class="col-12">
                <span>{{ isARC ? 'ARC' : 'AUT' }}值:</span>
              </div>
              <div class="col-12 text-center">
                <span class="enhance-text">{{ isARC ? arcCurrentLevel : autCurrentLevel }}</span>
                <span class="hint-text">/{{ isARC ? arcMaxLevel : autMaxLevel }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card">
          <div class="card-content">
            <div class="row g-0">
              <div class="col-12">
                <span>{{ job === 'normal' ? '主屬' : job === 'demon' ? '血量' : '三屬' }}加成:</span>
              </div>
              <div class="col-12 text-center">
                <span class="enhance-text">+{{ isARC ? arcCurrentAdd : autCurrentAdd }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- <div class="col-12 col-md-6">
        <div class="card">
          <div class="card-content">
            <div class="row g-0">
              <div class="col-12">
                <img :src="`/src/assets/img/icon/${isARC ? 2535000 : 2535001}.png`" class="icon">
                <b>{{ isARC ? '祕法觸媒' : '真實觸媒' }}</b>
              </div>
              <hr>
              <div class="col-4 col-sm-3">
                <label>要轉換的符文：</label>
              </div>
              <div class="col-4">
                <select class="form-control form-control-sm">
                  <option v-for="area in isARC ? arc : aut" :value="area.id">{{ area.name }}</option>
                </select>
              </div>
              <div class="w-100" />
              <div class="col-4 col-sm-3">
                轉換後等級：10
              </div>
              <div class="w-100" />
              <div class="col-4 col-sm-3">
                轉換後成長值：777
              </div>
              <div class="w-100" />
              <div class="col-4 col-sm-3">
                所需楓幣：66
              </div>
            </div>
          </div>
        </div>
      </div> -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nav-tabs {
  border-color: var(--color-navbar);
  // border-bottom: 2px solid var(--color-shadow);
  padding-left: 1rem;

  .nav-link {
    color: var(--color-navbar);
    cursor: pointer;

    &:hover {
      border-color: var(--color-shadow);
    }

    &.active {
      border-color: var(--color-navbar);
      background-color: var(--color-background);
      // border: 2px solid var(--color-shadow);
      margin-bottom: -2px;
      border-bottom: 1px solid var(--color-background);
    }
  }
}

// .card {
//   //box-shadow: 2px 2px 8px 0 var(--color-shadow);
//   background-color: var(--color-card);
//   border: 0;

//   .card-content {
//     padding: 1rem;

//     .input-sm {
//       width: 5rem;
//       margin-left: -2rem;
//     }

//     .icon {
//       height: 2rem;
//       padding-right: .5rem;
//       margin-top: -5px;
//     }

//     .label-text {
//       padding-left: .5rem;
//     }

//     hr {
//       margin: .5rem 0;
//     }
//   }
// }

.hint-text {
  color: var(--color-navbar-soft);
  padding-left: .5rem;
}

.enhance-text {
  font-size: 1.8rem;
}
</style>