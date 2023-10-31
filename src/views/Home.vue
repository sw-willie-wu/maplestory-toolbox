<template>
  <div class="home">
    <img alt="Vue logo" src="../assets/logo.png">
    <HelloWorld msg="Welcome to Your Vue.js App" />
    <!--pre>{{a}}</pre-->
  </div>
</template>

<script>
// @ is an alias to /src
// import { reactive } from 'vue'
import HelloWorld from '@/components/HelloWorld.vue'
import axios from 'axios'
import { Rune } from '../components/mst/rune.js'

export default {
  name: 'Home',
  components: {
    HelloWorld
  },
  setup() {
    // const a = reactive({})
    axios.get(`${process.env.VUE_APP_API_DOMAIN}/api/rune/`).then((res) => {
      const a = new Rune(res.data[0])
      // console.log(a.moneyNeedList)
      a.level = 6
      a.stack = 200
    })
    // const test = process.env.VUE_APP_API_DOMAIN
    // return { a }
  }
}

</script>
