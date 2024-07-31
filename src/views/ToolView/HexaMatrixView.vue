<script setup lang="ts">
import { reactive, computed } from 'vue'
import { HexaCore } from '@/utils/mst/hexa_core'
import hexaData from '@/assets/data/hexa.json'
import imgHexaBg from '@/assets/img/hexa/bg.png'
import imgHexaLayer from '@/assets/img/hexa/layer.png'
import imgHexaBgSprite from '@/assets/img/hexa/sprite.png'
import imgCoreSkill from '@/assets/img/hexa/skill.png'
import imgCoreSkillLock from '@/assets/img/hexa/skill-lock.png'
import imgCoreMastery from '@/assets/img/hexa/mastery.png'
import imgCoreMasteryLock from '@/assets/img/hexa/mastery-lock.png'
import imgCoreEnforce from '@/assets/img/hexa/enforce.png'
import imgCoreCommon from '@/assets/img/hexa/common.png'
import imgCoreCommonLock from '@/assets/img/hexa/common-lock.png'
import imgCoreSelect from '@/assets/img/hexa/core-select.png'


const skillCore = new HexaCore(hexaData.skillNeed)
const masteryCore = new HexaCore(hexaData.masteryNeed)
const enforceCore = new HexaCore(hexaData.enforceNeed)
const commonCore = new HexaCore(hexaData.commonNeed)

const coreHoverStatus = reactive(
  {
    top: 15,
    left: 15,
    border: false,
    panel: false,
    current: reactive<{ lv: number, img: string, locked: boolean }>({ lv: 0, img: '', locked: true })
  }
)

const corePower: Record<string, any> = reactive(
  {
    skill: {
      0: { lv: 1, img: imgCoreSkill, locked: false },
      1: { lv: 0, img: imgCoreSkillLock, locked: true },
      2: { lv: 0, img: imgCoreSkillLock, locked: true },
      3: { lv: 0, img: imgCoreSkillLock, locked: true },
      4: { lv: 0, img: imgCoreSkillLock, locked: true },
      5: { lv: 0, img: imgCoreSkillLock, locked: true },
    },
    mastery: {
      0: { lv: 0, img: imgCoreMastery, locked: false },
      1: { lv: 0, img: imgCoreMastery, locked: false },
      2: { lv: 0, img: imgCoreMasteryLock, locked: true },
      3: { lv: 0, img: imgCoreMasteryLock, locked: true },
    },
    enforce: {
      0: { lv: 0, img: imgCoreEnforce, locked: false },
      1: { lv: 0, img: imgCoreEnforce, locked: false },
      2: { lv: 0, img: imgCoreEnforce, locked: false },
      3: { lv: 0, img: imgCoreEnforce, locked: false },
    },
    common: {
      0: { lv: 0, img: imgCoreCommon, locked: false },
      1: { lv: 0, img: imgCoreCommonLock, locked: true },
      2: { lv: 0, img: imgCoreCommonLock, locked: true },
      3: { lv: 0, img: imgCoreCommonLock, locked: true },
    }
  }
)

const hoverCore = (event: any) => {
  if (event.target.classList.contains('core')) {
    coreHoverStatus.top = event.target.getBoundingClientRect().top
    coreHoverStatus.left = event.target.getBoundingClientRect().left
    coreHoverStatus.border = true
    let core = event.target.classList[1]
    if (core === 'core-level') {
      core = event.target.parentElement.classList[1]
    }
    core = core.split('-')
    let coreType: string = core[0]
    coreHoverStatus.current = corePower[coreType][core[1]]
    coreHoverStatus.panel = !coreHoverStatus.current.locked
  } else {
    coreHoverStatus.border = false
  }
}

const currentFragment = (core: object, data: HexaCore) => Object.values(core)
  .filter(x => x.locked === false)
  .reduce((a, b) => { return a + data.calculateTotalStack(b.lv) }, 0)

const totalFragment = (core: object, data: HexaCore) => Object.values(core)
  .filter(x => x.locked === false)
  .reduce((a, b) => { return a + data.calculateTotalStack(30) }, 0)

const currentSkillFragment = computed(() => currentFragment(corePower.skill, skillCore))
const currentMasteryFragment = computed(() => currentFragment(corePower.mastery, masteryCore))
const currentEnforceFragment = computed(() => currentFragment(corePower.enforce, enforceCore))
const currentCommonFragment = computed(() => currentFragment(corePower.common, commonCore))
const totalSkillFragment = computed(() => totalFragment(corePower.skill, skillCore))
const totalMasteryFragment = computed(() => totalFragment(corePower.mastery, masteryCore))
const totalEnforceFragment = computed(() => totalFragment(corePower.enforce, enforceCore))
const totalCommonFragment = computed(() => totalFragment(corePower.common, commonCore))


const currentStackFragment = computed(() => currentSkillFragment.value + currentMasteryFragment.value + currentEnforceFragment.value + currentCommonFragment.value)
const totalNeedFragment = computed(() => totalSkillFragment.value + totalMasteryFragment.value + totalEnforceFragment.value + totalCommonFragment.value)
</script>

<template>
  <div>
    <div class="row g-2 align-items-center justify-content-center custom-container">
      <div class="col-12 col-md-6">
        <div class="matrix-canvas" @mouseover="hoverCore">
          <img :src="imgHexaBg" class="matrix-bg" />
          <img :src="imgHexaLayer" class="matrix-lyr" />
          <div class="matrix-bg-sprite" :style="{ backgroundImage: `url(${imgHexaBgSprite})` }"></div>
          <div v-for="(coreData, coreType) in corePower">
            <div v-for="(coreInfo, coreID) in coreData">
              <div class="core" :class="`${coreType}-${coreID}`" :style="{ backgroundImage: `url(${coreInfo.img})` }">
                <div v-if="coreInfo.locked === false" class="core core-level">{{ coreInfo.lv }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-5">
        <div class="row gx-0 gy-4">
          <div class="card">
            <div class="card-content">
              核心完成進度 (依碎片需求量計算)
              <hr>
              <br>
              起源核心：{{ (currentSkillFragment / totalSkillFragment * 100).toFixed(2) }} %&nbsp;&nbsp;&nbsp;( {{
                currentSkillFragment }} /
              {{
                totalSkillFragment }} )<br><br>
              精通核心：{{ (currentMasteryFragment / totalMasteryFragment * 100).toFixed(2) }} %&nbsp;&nbsp;&nbsp;( {{
                currentMasteryFragment }} /
              {{
                totalMasteryFragment }} )<br><br>
              強化核心：{{ (currentEnforceFragment / totalEnforceFragment * 100).toFixed(2) }} %&nbsp;&nbsp;&nbsp;( {{
                currentEnforceFragment }} /
              {{
                totalEnforceFragment }} )<br><br>
              共用核心：{{ (currentCommonFragment / totalCommonFragment * 100).toFixed(2) }} %&nbsp;&nbsp;&nbsp;( {{
                currentCommonFragment }} /
              {{
                totalCommonFragment }} )<br><br>
              總計：{{ (currentStackFragment / totalNeedFragment *
                100).toFixed(2) }} %&nbsp;&nbsp;&nbsp;( {{
                currentStackFragment }} /
              {{
                totalNeedFragment }} )<br><br>
            </div>
          </div>
        </div>
      </div>
    </div>
    <img v-if="coreHoverStatus.border" class="core" :src="imgCoreSelect"
      :style="{ top: `${coreHoverStatus.top}px`, left: `${coreHoverStatus.left}px` }" />
    <div v-if="coreHoverStatus.panel" class="core-level-panel"
      :style="{ top: `${coreHoverStatus.top}px`, left: `${coreHoverStatus.left}px` }"
      @mouseleave="coreHoverStatus.panel = false">
      <button :disabled="coreHoverStatus.current.lv <= 0" @click="coreHoverStatus.current.lv--">−</button>
      <button :disabled="coreHoverStatus.current.lv >= 30" @click="coreHoverStatus.current.lv++">+</button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.custom-container {
  min-height: 80vh;
}

.matrix-canvas {
  width: 506px;
  height: 507px;
  position: relative;
  margin: auto;
  z-index: 0;
  background-color: rgba(0, 0, 0, 0.85);
  border-radius: 5%;
}

.matrix-bg {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  border-radius: 5%;
}

.matrix-lyr {
  position: absolute;
  top: 22px;
  left: 30px;
  z-index: 3;
}

@keyframes sprite {
  to {
    background-position: -6800px;
  }
}

.matrix-bg-sprite {
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 2;
  height: 456px;
  width: 425px;
  animation: sprite 1.6s steps(16) infinite;
}

.core-level {
  font-size: 2rem;
  color: rgb(235, 235, 235);
  padding-top: 20px;
  text-align: center;
}

.core-level-panel {
  position: absolute;
  background-color: var(--color-card);
  width: 6rem;
  height: 3rem;
  border-radius: 6px;
  z-index: 10;
  text-align: center;
  font-size: 2rem;
  line-height: 1.5rem;
  box-shadow: 0 1px 4px 0 var(--color-shadow);
  margin-top: 15px;
  margin-left: 70px;

  button {
    margin-top: .5rem;
    padding-bottom: .5rem;
    border: 0;
    background-color: var(--color-card);

    &:hover {
      box-shadow: 0 1px 4px 0 var(--color-shadow);
    }

    &:active {
      box-shadow: 0 0 4px 0 var(--color-shadow);
      transform: translateY(1px);
    }
  }
}

.core {
  position: absolute;
  z-index: 4;
  width: 68px;
  height: 78px;

  &.skill-0 {
    top: 142px;
    left: 170px;
  }

  &.skill-1 {
    top: 142px;
    left: 100px;
  }

  &.skill-2 {
    top: 82px;
    left: 135px;
  }

  &.skill-3 {
    top: 82px;
    left: 65px;
  }

  &.skill-4 {
    top: 22px;
    left: 100px;
  }

  &.skill-5 {
    top: 22px;
    left: 30px;
  }

  &.mastery-0 {
    top: 142px;
    left: 268px;
  }

  &.mastery-1 {
    top: 82px;
    left: 303px;
  }

  &.mastery-2 {
    top: 82px;
    left: 373px;
  }

  &.mastery-3 {
    top: 22px;
    left: 408px;
  }

  &.enforce-0 {
    top: 286px;
    left: 170px;
  }

  &.enforce-1 {
    top: 346px;
    left: 135px;
  }

  &.enforce-2 {
    top: 346px;
    left: 65px;
  }

  &.enforce-3 {
    top: 406px;
    left: 30px;
  }

  &.common-0 {
    top: 286px;
    left: 268px;
  }

  &.common-1 {
    top: 346px;
    left: 303px;
  }

  &.common-2 {
    top: 346px;
    left: 373px;
  }

  &.common-3 {
    top: 406px;
    left: 408px;
  }
}
</style>