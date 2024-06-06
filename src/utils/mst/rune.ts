export class Rune {
    id: number
    name: string
    nameEn: string
    maxDailyGain: number
    partyName: string | null
    maxPartyGain: number
    bonusArea: string | null
    maxBonusGain: number
    symbol: string
    maxLevel: number
    gainLevel: number
    runeNeedList: number[]
    moneyNeedList: number[]
    doDaily: boolean
    doBonus: boolean
    doParty: boolean
    level: number
    stack: number

    constructor(jsonData: any) {
        this.id = jsonData.id
        this.name = jsonData.name
        this.nameEn = jsonData.nameEn
        this.maxDailyGain = jsonData.dailyGain
        this.partyName = jsonData.partyName
        this.maxPartyGain = jsonData.partyGain
        this.bonusArea = jsonData.bonusArea
        this.maxBonusGain = jsonData.bonusGain
        this.symbol = jsonData.symbol
        this.maxLevel = jsonData.maxLevel
        this.gainLevel = jsonData.gainLevel
        this.runeNeedList = Object.values(jsonData.runeNeed)
        this.moneyNeedList = Object.values(jsonData.moneyNeed) 
        this.doDaily = true
        this.doBonus = jsonData.bonusGain != 0 ? true : false
        this.doParty = jsonData.partyGain != 0 ? true : false
        this.level = 1
        this.stack = 1
    }
  
    calculateForceValue = (level: number) => {
        return level === 0 ? 0 : this.symbol === 'ARC' ? level * 10 + 20 : level * 10
    }
  
    calculateTotalStack = (level: number, stack: number) => {
        return level <= 1 ? stack : this.runeNeedList.slice(0, level - 1).reduce((a, b) => a + b) + stack
    }
  
    calculateMoneyNeed = (startLevel: number, targetLevel: number) => {
      startLevel = startLevel <= 1 ? 0 : startLevel === targetLevel ? targetLevel : startLevel - 1
        return startLevel < targetLevel ? this.moneyNeedList.slice(startLevel, targetLevel).reduce((a, b) => a + b) * 10000 : 0
    }

    calculateDayNeed = (startLevel: number, targetLevel: number, stack: number) => {
        const currentStack = this.calculateTotalStack(startLevel, stack)
        const targetStack = this.calculateTotalStack(targetLevel, 0)
        const totalNeed = targetStack - currentStack
        const weekNeed = totalNeed <= 0 ? 0 : this.totalWeeklyGain > 0 ? Math.ceil(totalNeed / this.totalWeeklyGain) : Infinity
        
        let dayNeed: number = 0
        if (weekNeed <= 0) {
            dayNeed = 0
        } else if (weekNeed !== Infinity) {
            if ((totalNeed - (weekNeed-1)*this.totalWeeklyGain) <= this.partyGain+this.totalDailyGain) {
                dayNeed = (weekNeed - 1) * 7 + 1
            } else {
                let past = weekNeed - 1
                dayNeed = Math.ceil((totalNeed - (past * this.totalWeeklyGain + this.partyGain)) / this.totalDailyGain) + past * 7
            }
        } else {
            dayNeed = Infinity
        }
        return dayNeed
    }
  
    checkStack = () => {
      if (this.stack > this.calculateTotalStack(this.maxLevel, 0)) {
        this.stack = this.calculateTotalStack(this.maxLevel, 0)
      }
      if (this.stack < 0) {
        this.stack = 0
      }
    }
  
    get dailyGain(): number {
        return this.doDaily ? this.maxDailyGain : 0
    }
  
    get bonusGain(): number {
        return this.doBonus ? this.maxBonusGain : 0
    }

    get partyGain(): number {
        return this.doParty ? this.maxPartyGain : 0
    }

    get totalDailyGain() {        
        return this.dailyGain + this.bonusGain
    }

    get totalWeeklyGain() {
        return this.totalDailyGain * 7 + this.partyGain
    }
  
//     get totalDailyObtain() {
//       const p = this.isParty ? (this.partyGain / this.exchangeRatio) / 7 : 0
//       const b = this.isDaily && this.isBonus ? this.bonusGain : 0
//       return this.dailyGain + p + b
//     }
  
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

    get currentMaxStack() {
        return this.level === 0 ? 0 : this.level === this.maxLevel ? 'MAX ' : this.runeNeedList[this.level - 1]
    }

    get dayNeed() {
      return this.calculateDayNeed(this.level, this.maxLevel, this.stack)
    }
  }
  
//   export { Rune }
  