module.exports = {
    // publicPath: process.env.NODE_ENV === 'production' ? '/gnss/' : '/',
    devServer: {
      host: '0.0.0.0',
      port: process.env.VUE_APP_CONTAINER_PORT,
    },
    // configureWebpack: {
    //   devServer: {
    //     watchOptions: {
    //       poll: true
    //     }
    //   }
    // },
    css: {
      loaderOptions: {
        scss: {
          prependData: '@import "~@/assets/main.scss";'
        }
      }
    },
    assetsDir: 'static'
  }