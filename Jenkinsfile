node {
  try {
    docker.withRegistry('https://registry.hub.docker.com', 'docker-registry-login') {
      stage('Checkout') {
        checkout scm
      }
      def myDocker = docker.image("scomm/node-build:latest")
      myDocker.pull()
      myDocker.inside("-v ${env.WORKSPACE}:/var/www/html -u 0:0") {
        stage('Yarn') {
          sh 'yarn'
        }
      }
    }

  } catch (e) {
    slackSend color: 'bad', message: "Failed building ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
    process.exit(1)
  }

  if (!env.BRANCH_NAME.contains('PR-')) {
    try {
      docker.withRegistry('https://664537616798.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-jenkins-login') {
        stage('Build Container') {
          myDocker = docker.build("hookr-server:v${env.BUILD_NUMBER}", '.')
        }
        stage('Push Container') {
          myDocker.push("latest");
          myDocker.push("v${env.BUILD_NUMBER}");
        }
      }
      stage('Upgrade Container') {
        rancher confirm: true, credentialId: 'rancher', endpoint: 'https://rancher.as3.io/v2-beta', environmentId: '1a18', image: "664537616798.dkr.ecr.us-east-1.amazonaws.com/hookr-server:v${env.BUILD_NUMBER}", service: 'hookr/server', environments: '', ports: '', timeout: 30
      }
      stage('Notify Upgrade') {
        slackSend color: 'good', message: "Finished deploying ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
      }
    } catch (e) {
      slackSend color: 'bad', message: "Failed deploying ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
      process.exit(1)
    }
  }
}
