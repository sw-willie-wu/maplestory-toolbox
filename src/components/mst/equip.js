class Equip {
  constructor(queryData) {
    this.id = queryData.id
    this.name = queryData.name
    this.desc = queryData.desc
    this.category = queryData.category
    this.subCategory = queryData.subCategory
    this.mainJob = queryData.mainJob
    this.specJob = queryData.specJob
    this.reqLevel = queryData.reqLevel
    this.isCash = queryData.isCash
    this.setInfo = queryData.setInfo
    this.tuc = queryData.tuc
    this.coloring = queryData.coloring
    this.detail = JSON.parse(queryData.detail)
  }

  get maxStar() {
    const starRef = [
      { lvMin: 0, lvMax: 100, starMax: 5, keyword: '赫力席母', starMax2: 3 },
      { lvMin: 100, lvMax: 110, starMax: 8, keyword: 'X', starMax2: 8 },
      { lvMin: 110, lvMax: 120, starMax: 10, keyword: '超新星', starMax2: 8 },
      { lvMin: 120, lvMax: 130, starMax: 15, keyword: 'X', starMax2: 15 },
      { lvMin: 130, lvMax: 140, starMax: 20, keyword: 'X', starMax2: 20 },
      { lvMin: 140, lvMax: 260, starMax: 25, keyword: '塔蘭特', starMax2: 15 }
    ]
    const range = starRef.filter((item) => { return item.lvMin <= this.reqLevel & item.lvMax > this.reqLevel })[0]
    return this.category.id === 5 ? 0 : this.name.includes(range.keyword) ? range.starMax2 : range.starMax
  }
}

export { Equip }
