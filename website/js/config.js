var uxapihost = "https://api.catherineweaver.uxapi.io"
var clientID = ""
var clientSecret = ""
$.ajax({
  url: uxapihost + '/tmp',
  async: false,
  type:'GET',
  success: function(text){
      if(typeof(text.error) != 'undefined') {
        console.log(text.error)
//        return text.error
      }
      else {
        configkeys = text
        clientID = configkeys.object.id
        clientSecret = configkeys.object.secret
      }
  },
  error: function(err) {
      //console.log(err)
  }
});
