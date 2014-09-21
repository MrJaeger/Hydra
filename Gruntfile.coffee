module.exports = (grunt) ->
    grunt.initConfig

        pkg: grunt.file.readJSON('package.json')

        coffee:
            options:
                sourceMap: false

            compile:
                files: [{
                    expand: true
                    cwd: 'src/'
                    src: ['*.coffee']
                    dest: 'dist/'
                    ext: '.js'
                }]

            compileExample:
                files: [{
                    expand: true
                    cwd: 'src/'
                    src: ['hydra-client.coffee']
                    dest: 'example/static/js/'
                    ext: '.js'
                }]

        watch:
            options:
                livereload: 13337

            coffee:
                files: 'src/*.coffee'
                tasks: ['coffee']

    grunt.loadNpmTasks('grunt-contrib-coffee')
    grunt.loadNpmTasks('grunt-contrib-watch')

    grunt.registerTask('default', ['watch', 'coffee'])