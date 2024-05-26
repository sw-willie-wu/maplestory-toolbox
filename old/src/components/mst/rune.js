class Rune {
  constructor(apiData) {
    this.name = apiData.name
    this.nameEn = apiData.nameEn
    this.maxDailyGain = apiData.dailyGain
    this.partyName = apiData.partyName
    this.maxPartyGain = apiData.partyGain
    this.bonusArea = apiData.bonusArea
    this.maxBonusGain = apiData.bonusGain
    this.isCoin = apiData.isCoin
    this.exchangeRatio = apiData.exchangeRatio
    this.symbol = apiData.symbol
    this.maxLevel = apiData.maxLevel
    this.gainLevel = apiData.gainLevel
    this.runeNeedList = Object.values(apiData.runeNeed)
    this.moneyNeedList = Object.values(apiData.moneyNeed)
    this.isDaily = true
    this.isParty = true
    this.isBonus = true
    this.partyGain = apiData.partyGain
    this.level = 1
    this.stack = 1
  }

  calculateForceValue = level => {
    return level === 0 ? 0 : this.symbol === 'ARC' ? level * 10 + 20 : level * 10
  }

  calculateTotalStack = (level, stack) => {
    return level <= 1 ? stack : this.runeNeedList.slice(0, level - 1).reduce((a, b) => a + b) + stack
  }

  calculateMoneyNeed = (startLevel, targetLevel) => {
    startLevel = startLevel <= 1 ? 0 : startLevel === targetLevel ? targetLevel : startLevel - 1
    return startLevel < targetLevel ? this.moneyNeedList.slice(startLevel, targetLevel).reduce((a, b) => a + b) * 10000 : 0
  }

  calculateDayNeed = (level, stack, targetLevel, partyGain, isDaily, isParty, isBonus) => {
    const currentStack = this.calculateTotalStack(level, stack)
    const targetStack = this.calculateTotalStack(targetLevel, 0)
    const totalNeed = targetStack - currentStack
    return totalNeed <= 0 ? 0 : this.totalDailyObtain > 0 ? Math.ceil(totalNeed / this.totalDailyObtain) : 'X'
  }

  checkStack = () => {
    if (this.stack > this.runeNeedList.slice(this.level - 1).reduce((a, b) => a + b)) {
      this.stack = this.runeNeedList.slice(this.level - 1).reduce((a, b) => a + b)
    }
    if (this.stack < 0) {
      this.stack = 0
    }
  }

  checkJob = job => {
    return job === 'normal' ? this.normalAdd : job === 'demon' ? this.demonAdd : job === 'xenon' ? this.xenonAdd : null
  }

  get dailyGain() {
    return this.isDaily ? this.maxDailyGain : 0
  }

  get bonusGain() {
    return this.isBonus ? this.maxBonusGain : 0
  }

  get totalDailyObtain() {
    const p = this.isParty ? (this.partyGain / this.exchangeRatio) / 7 : 0
    const b = this.isDaily && this.isBonus ? this.bonusGain : 0
    return this.dailyGain + p + b
  }

  get forceValue() {
    return this.calculateForceValue(this.level)
  }

  get normalAdd() {
    return this.forceValue === 0 ? 0 : this.symbol === 'ARC' ? this.forceValue * 10 : 300 + this.forceValue * 20
  }

  get demonAdd() {
    return this.forceValue === 0 ? 0 : this.symbol === 'ARC' ? this.forceValue * 175 : 5200 + this.forceValue * 350
  }

  get xenonAdd() {
    return this.forceValue === 0 ? 0 : this.symbol === 'ARC' ? this.forceValue * 3.9 : 117 + this.forceValue * 7.8
  }

  get totalStack() {
    return this.calculateTotalStack(this.level, this.stack)
  }

  get moneyNeed() {
    return this.calculateMoneyNeed(this.level, this.maxLevel)
  }

  get dayNeed() {
    return this.calculateDayNeed(this.level, this.stack, this.maxLevel, this.partyGain, this.isDaily, this.isParty, this.isBonus)
  }
}

export { Rune }
