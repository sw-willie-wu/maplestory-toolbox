import mainJob from '@/assets/db/mainJob.json'
import specJob from '@/assets/db/specJob.json'
import setInfo from '@/assets/db/setInfo.json'
import category from '@/assets/db/category.json'
import subCategory from '@/assets/db/subCategory.json'
import equip from '@/assets/db/equip.json'
import scroll from '@/assets/db/scroll.json'

class Scroll {
  constructor(data) {
    this.data = data
    this.cashScrollIndex = {
      g: 0,
      red: 1,
      x: 2,
      v: 3,
      black: 4,
      glory: 5,
      destiny: 6
    }
    this.spellIndex = {
      str: 0,
      dex: 1,
      int: 2,
      luk: 3,
      hp: 4,
      all: 5,
      pad: 6,
      mad: 7
    }
  }

  _filter = len => {
    return Object.keys(this.data).filter(key => key.split('_').length === len)
      .reduce((obj, key) => {
        let attri = ''
        let atkType = ''
        let atkTrans = ''
        if (len === 3) {
          attri = this.data[key].str
          atkType = key.split('_')[2]
          atkTrans = atkType === 'pad' ? '物攻' : '魔攻'
          if (this.data[key].p.length === 1) {
            this.data[key].desc = `${atkTrans} + ${this.data[key][atkType][0]} / 全屬性 + ${attri[0]}`
          } else {
            if (this.data[key].str.length === 1) {
              this.data[key].desc = `${atkTrans} + ${this.data[key][atkType][0]} ~ ${this.data[key][atkType].slice(-1)[0]} / 全屬性 + ${attri[0]}`
            } else {
              this.data[key].desc = `${atkTrans} + ${this.data[key][atkType][0]} ~ ${this.data[key][atkType].slice(-1)[0]} / 全屬性 + ${attri[0]} ~ ${attri.slice(-1)[0]}`
            }
          }
        }
        if (len === 4) {
          attri = key.split('_')[2]
          if (attri === 'all') {
            this.data[key].desc = `全屬性 + ${this.data[key].str[0]}`
          } else if (['pad', 'mad'].includes(attri)) {
            atkTrans = attri === 'pad' ? '物攻' : '魔攻'
            this.data[key].desc = `${atkTrans} + ${this.data[key][attri][0]}`
          } else {
            atkType = this.data[key].pad[0] > 0 ? 'pad' : this.data[key].mad[0] > 0 ? 'mad' : ''
            atkTrans = atkType === '' ? '' : `${atkType === 'pad' ? '物攻' : '魔攻'} + ${this.data[key][atkType][0]} / `
            this.data[key].desc = `${atkTrans}${attri.toUpperCase()} + ${this.data[key][attri][0]}`
          }
        }
        return Object.assign(obj, { [key]: this.data[key] })
      }, {})
  }

  get cashScroll() {
    return this._filter(3)
  }

  get spell() {
    return this._filter(4)
  }

  queryCashScroll = (category, atkType) => {
    return Object.keys(this.cashScroll)
      .filter(key => key.includes(atkType) && key.includes(category))
      .sort((a, b) => {
        const a1 = a.split('_')[0]
        const a2 = b.split('_')[0]
        if (this.cashScrollIndex[a1] > this.cashScrollIndex[a2]) return 1
        if (this.cashScrollIndex[a1] < this.cashScrollIndex[a2]) return -1
        return 0
      })
      .reduce((obj, key) => {
        return Object.assign(obj, { [key]: scroll[key] })
      }, {})
  }

  querySpell = (equip, atkType) => {
    const levelClass = equip.reqLevel < 75 ? 75 : equip.reqLevel < 115 ? 115 : 200
    const part = equip.subCategory.nameEn === 'glove' ? 'glove' : equip.category.nameEn.toLowerCase()

    let queryset = Object.keys(this.spell).filter(key => key.includes(`_${levelClass}`) && part.includes(key.split('_')[1]))

    if (part === 'glove') {
      queryset = queryset.filter(key => key.includes(atkType))
    } else {
      queryset = queryset.filter(key => equip.mainJob.attri.includes(key.split('_')[2]))
    }

    return queryset
      .sort((a, b) => {
        const p1 = parseInt(a.split('_')[0])
        const p2 = parseInt(b.split('_')[0])
        if (p1 < p2) return 1
        if (p1 > p2) return -1
        return 0
      })
      .sort((a, b) => {
        const a1 = a.split('_')[2]
        const a2 = b.split('_')[2]
        if (this.sortspellIndex[a1] > this.sortspellIndex[a2]) return 1
        if (this.sortspellIndex[a1] < this.sortspellIndex[a2]) return -1
        return 0
      })
      .reduce((obj, key) => {
        return Object.assign(obj, { [key]: scroll[key] })
      }, {})
  }
}

class DB {
  constructor() {
    this.mainJob = mainJob
    this.specJob = specJob
    this.setInfo = setInfo
    this.category = category
    this.subCategory = subCategory
    this.equip = equip
    this.scroll = new Scroll(scroll)
  }

  queryById = (node, id) => {
    return this[node].filter(item => item.id === id)
  }

  queryEquip = (levelMin, levelMax, subcategoryId, cash) => {
    return this.equip.filter(item => item.subCategoryId === subcategoryId && item.reqLevel >= levelMin && item.reqLevel <= levelMax && item.isCash === cash)
  }

  queryUpgradableEquip = (levelMin, levelMax, subcategoryId) => {
    return this.equip.filter(item => item.subCategoryId === subcategoryId && item.reqLevel >= levelMin && item.reqLevel <= levelMax && item.tuc > 0)
  }

  getEquip = equipId => {
    let equip = this.queryById('equip', equipId)
    if (equip.length > 0) {
      equip = equip[0]
      equip.mainJob = this.queryById('mainJob', equip.mainJobId)[0]
      if (equip.specJobId != null) {
        equip.specJob = this.queryById('specJob', equip.specJobId)[0]
      } else {
        equip.specJob = null
      }
      if (equip.setInfoId != null) {
        equip.setInfo = this.queryById('setInfo', equip.setInfoId)[0]
      } else {
        equip.setInfo = null
      }
      equip.subCategory = this.queryById('subCategory', equip.subCategoryId)[0]
      equip.category = this.queryById('category', equip.subCategory.categoryId)[0]
    }
    return equip
  }
}

const mstDB = new DB()

export { mstDB }
