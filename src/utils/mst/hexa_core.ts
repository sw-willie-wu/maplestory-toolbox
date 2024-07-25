export class HexaCore {
    fragmentNeedList: number[]

    constructor(jsonData: any) {
        this.fragmentNeedList = Object.values(jsonData)
    }

    calculateTotalStack = (level: number) => {
        return level <= 0 ?  0 :this.fragmentNeedList.slice(0, level).reduce((a, b) => a + b)
    }
}