<template>
  <div class="star_reel">
    <div class="row g-2">
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content mid">
            <div class="row gy-2 align-items-center">
              <label class="col-auto col-form-label">裝備等級：</label>
              <div class="col-8">
                <select v-model="query.level" number class="form-control-sm mid" @change="autoSelect">
                  <option v-for="lv in 26" :key="lv" :value="(lv - 1) * 10">
                    {{ (lv - 1) * 10 }} ~ {{ (lv - 1) * 10 + 9 }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content mid">
            <form>
              <div class="row gy-2 align-items-center">
                <label class="col-auto col-form-label">類型&nbsp;/&nbsp;部位：</label>
                <div class="col-3 full-col">
                  <select v-model="query.category" number class="form-control-sm mid" @change="autoSelect">
                    <option v-for="category_element in categoryArray" :key="category_element"
                      :value="category_element.id">
                      {{ category_element.name }}
                    </option>
                  </select>
                </div>
                <div class="col-auto">/</div>
                <div class="col-3 full-col">
                  <select v-model="query.subCategory" number class="form-control-sm mid" @change="autoSelect">
                    <option v-for="sub_category_element in subCategoryArray" :key="sub_category_element"
                      :value="sub_category_element.id">
                      {{ sub_category_element.name }}
                    </option>
                  </select>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content mid">
            <div class="row gy-2 align-items-center">
              <label class="col-auto col-form-label">裝備名稱：</label>
              <div class="col-8">
                <select v-model="equipID" number class="form-control-sm mid">
                  <option v-for="equip_element in equipArray" :key="equip_element" :value="equip_element.id">
                    {{ equip_element.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content mid">
            <div class="row gy-2 align-items-center">
              <label class="col-auto col-form-label">星力等級：</label>
              <div class="col-8">
                <select v-model="equipAdd.star" number class="form-control-sm mid" v-if="equip !== null">
                  <option v-for="star in equip.maxStar + 1" :key="star" :value="(star - 1)">
                    {{ star - 1 }}
                  </option>
                </select>
                <select v-model="equipAdd.star" number class="form-control-sm mid" v-else>
                  <option value="0">0</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content mid">
            <form>
              <div class="row gy-2 align-items-center">
                <label class="col-auto col-form-label">黃錘&nbsp;/&nbsp;白錘：</label>
                <div class="col-3 full-col">
                  <select v-model="equipAdd.goldenHammer" number class="form-control-sm mid">
                    <option v-for="tucNum in 2" :key="tucNum" :value="(tucNum - 1)">
                      {{ tucNum - 1 }}
                    </option>
                  </select>
                </div>
                <div class="col-auto">/</div>
                <div class="col-3 full-col">
                  <select v-model="equipAdd.platinumHammer" number class="form-control-sm mid">
                    <option v-for="tucNum in 6" :key="tucNum" :value="(tucNum - 1)">
                      {{ tucNum - 1 }}
                    </option>
                  </select>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content mid">
            <div class="row gy-2 align-items-center">
              <label class="col-auto col-form-label">卷軸類型：</label>
              <div class="col-8">
                <select v-model="equipAdd.type" number class="form-control-sm mid">
                  <option value="pad">物攻</option>
                  <option value="mad">魔攻</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <br>
    <div class="row g-2">
      <div v-for="scrollName in Object.keys(equipAdd.cashScrollCount)" :key="scrollName" class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content">
            <div class="row no-gutters">
              <div class="col-1">
                <img :src="require(`../assets/img/reel-${scrollName}.png`)" height="35" style="margin-top: 8px;">
              </div>
              <div class="col-10" style="margin-left: 15px;">
                <b>&nbsp;&nbsp;{{ cashScroll[`${scrollName}_${equipAdd.category}_${equipAdd.type}`].name }}</b>
                <br>
                <span class="desc">({{ cashScroll[`${scrollName}_${equipAdd.category}_${equipAdd.type}`].desc }})</span>
              </div>
            </div>
            <hr>
            <form>
              <div class="row gy-2 align-items-center">
                <label class="col-auto col-form-label">充卷張數：</label>
                <div class="col-8" style="margin-left: 0">
                  <select v-model="equipAdd.cashScrollCount[scrollName]" number class="form-control-sm mid"
                    v-if="equip !== null">
                    <option v-for="tucNum in equipAdd.goldenHammer + equipAdd.platinumHammer + equip.tuc + 1"
                      :key="tucNum" :value="(tucNum - 1)">
                      {{ tucNum - 1 }}
                    </option>
                  </select>
                  <select v-model="equipAdd.cashScrollCount[scrollName]" number class="form-control-sm mid" v-else>
                    <option value="0">0</option>
                  </select>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
    <br>
    <!-- <div class="row g-2">
      <div v-for="spellName in Object.keys(spell)" :key="spellName" class="col-12 col-md-6 col-xl-4">
        <div class="card custom-card">
          <div class="card-content">
            <div class="row no-gutters">
              <div class="col-1">
                <img :src="require(`../assets/img/spell-${spellName.split('_')[0]}.png`)" height="35"
                  style="margin-top: 8px;">
              </div>
              <div class="col-10" style="margin-left: 15px;">
                <b>&nbsp;&nbsp;{{ spell[`${spellName}`].name }}</b>
                <br>
                <span class="desc">({{ spell[spellName].desc }})</span>
              </div>
            </div>
            <hr>
            <form>
              <div class="row gy-2 align-items-center">
                <label class="col-auto col-form-label">充卷張數：</label>
                <div class="col-8" style="margin-left: 0">
                  <select v-model="equipAdd.cashScrollCount[scrollName]" number class="form-control-sm mid">
                    <option v-for="tucNum in equipAdd.goldenHammer + equipAdd.platinumHammer + equip.tuc + 1"
                      :key="tucNum" :value="(tucNum - 1)">
                      {{ tucNum - 1 }}
                    </option>
                  </select>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div> -->
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { mstDB } from '../components/mst/db.js'
import { Equip } from '../components/mst/equip.js'

const query = reactive({
  level: Math.floor(Math.random() * 20) * 10,
  category: 1,
  subCategory: 6
})

const categoryArray = mstDB.category.filter((item) => { return ![5, 7].includes(item.id) })

const subCategoryArray = computed(() => mstDB.subCategory.filter((item) => {
  return item.categoryId === query.category && ![24, 26, 117, 102, 103, 116, 118, 119, 120, 121, 122, 123, 125].includes(item.id)
}))

const equipArray = computed(() => {
  let arr = mstDB.queryUpgradableEquip(query.level, query.level + 9, query.subCategory)
  if (arr.length <= 0) {
    arr = [{ id: 0, name: '無', maxStar: 0 }]
  }
  return arr
})

const equipID = ref(0)
const equip = computed(() => equipID.value !== 0 ? new Equip(mstDB.getEquip(equipID.value)) : null) // { maxStar: 0, tuc: 0, category: JSON.parse('{"name": ""}'), mainJob: JSON.parse('{"id": 0}') })
const equipAdd = reactive({
  star: 0,
  goldenHammer: 0,
  platinumHammer: 0,
  category: 'armor',
  part: 'armor',
  type: 'pad',
  cashScrollCount: {
    g: 0,
    red: 0,
    x: 0,
    v: 0,
    black: 0,
    glory: 0,
    destiny: 0
  }
})
const translate = {
  pad: '攻擊力',
  mad: '魔力'
}

const cashScroll = computed(() => {
  const queryset = mstDB.scroll.queryCashScroll(equipAdd.category, equipAdd.type)
  for (const [key, value] of Object.entries(queryset)) {
    if (value.str.length === 1) {
      queryset[key].desc = `${translate[equipAdd.type]} + ${value[equipAdd.type][0]} / 全屬 + ${value.str[0]}`
    } else {
      queryset[key].desc = `${translate[equipAdd.type]} + ${value[equipAdd.type][0]} ~ ${value[equipAdd.type].slice(-1)[0]} / 全屬 + ${value.str[0]} ~ ${value.str.slice(-1)[0]}`
    }
  }
  return queryset
})

// const spell = computed(() => {
//   const queryset = mstDB.scroll.querySpell(equip.value, equipAdd.type)
//   for (const [key, value] of Object.entries(queryset)) {
//     if (key.split('_')[1] !== 'glove') {
//       queryset[key].desc = `${translate[equipAdd.type]} + ${value[equipAdd.type][0]} / ${key.split('_')[2].toUpperCase()} + ${value[key.split('_')[2]][0]}`
//     } else {
//       queryset[key].desc = `${translate[equipAdd.type]} + ${value[equipAdd.type][0]}`
//     }
//   }
//   return queryset
// })

const autoSelect = () => {
  equipAdd.category = query.category === 1 ? 'armor' : query.category === 2 ? 'accessory' : 'weapon'
  equipAdd.part = query.subCategory === 14 ? 'glove' : query.category === 2 ? 'accessory' : query.category === 1 ? 'armor' : 'weapon'
  if (!subCategoryArray.value.map(elem => elem.id).includes(query.subCategory)) {
    query.subCategory = subCategoryArray.value[0].id
  }
  if (!equipArray.value.map(elem => elem.id).includes(equipID)) {
    equipID.value = equipArray.value[0].id
  }
  if (equip.value !== null && equip.value.maxStar < equipAdd.star) {
    equipAdd.star = equip.value.maxStar
  }
}

onMounted(() => {
  autoSelect()
})
</script>

<style scoped lang="scss">
.form-control-sm {
  border: 1px solid rgba(0, 0, 0, 0.2);

  &.mid {
    width: 100%;
  }
}

.full-col {
  padding: 0;
}

.desc {
  font-size: .8rem;
  padding-left: 8px;
}
</style>
