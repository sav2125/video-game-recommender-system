function deleteAds(index){

console.log("called Delete ads");

var id=document.getElementById('ad'+index).innerHTML;
   
    
    $.ajax({
        url:"/api/deleteads",
        type:"POST",
        data:JSON.stringify({'id':id}),
        contentType:"application/json",
        dataType:"json",
        success: function(data){
            console.log(data);
            if (data.message=="success")
                window.location = "/home";
            console.log('================');

        }
    });
    
    //console.log(name);
    console.log(index);
    console.log(id);
}


function search()
{
    
    var text=document.getElementById("text").value;
    console.log(text);
    window.location="/home?q="+text;    
 
}



function SendSNSNotification(gameName, gameOwnerEmail, gameOwner)
{
    
   
    console.log(gameName,gameOwnerEmail,gameOwner);
    window.location="/sendNotification?name="+gameName + "," + gameOwner + "," + gameOwnerEmail;    
 
}


function search1(name)
{
    
    console.log(name);
    window.location="/home?q="+name;    
 
}
function modal(index)
{

    console.log(index);
    function testFun(variable){
document.getElementById('#testH1').innerHTML=0;
}
}


function getPlaceFromFlickr(lat,lon,callback){
    // the YQL statement
    var yql = 'select * from flickr.places where lat='+lat+' and lon='+lon + 'and api_key=7f6776b5a5499c29f23ed4ef968a2ff7';

    // assembling the YQL webservice API
    var url = 'https://query.yahooapis.com/v1/public/yql?q='+
    encodeURIComponent(yql)+'&format=json&diagnostics='+
    'false&callback='+callback;

    // create a new script node and add it to the document
    var s = document.createElement('script');
    s.setAttribute('src',url);
    document.getElementsByTagName('head')[0].appendChild(s);
  };

  // callback in case there is a place found
  function output(o){
    if(typeof(o.query.results.places.place) != 'undefined'){
      var locationElement = document.getElementById('location');
      locationElement.value  = o.query.results.places.place.name;
    }
  }


  if(navigator.geolocation){
    // get the current position
    navigator.geolocation.getCurrentPosition(
      // if this was successful, get the latitude and longitude
      function(position){
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        console.log(lat);
        console.log(lon);
        getPlaceFromFlickr(lat,lon, 'output')
      },
      // if there was an error
      function(error){
        alert('ouch');
      });
    }


    var cors_api_url = 'https://cors-anywhere.herokuapp.com/';
    function doCORSRequest(options, printResult) {
      var x = new XMLHttpRequest();
      x.open(options.method, cors_api_url + options.url);
      x.onload = x.onerror = function() {
          console.log(x.responseText);
        printResult(x.responseText);

      };
      x.send(options.data);
    }
    var delay = (function(){
      var timer = 0;
      return function(callback, ms){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
      };
    })();

    function getSimilarGamesList()
    {
      var input = document.getElementById("name");
      var awesomplete = new Awesomplete(input);
      awesomplete.open();
      delay(function(){
        var nameElement = document.getElementById('name');
        var gamesListUrl = "http://thegamesdb.net/api/GetGamesList.php?name=" +   nameElement.value;
        var newgameUrl = "http://www.giantbomb.com/api/search/?query="+nameElement.value+"&resources=game&api_key=&format=json&field_list=name,api_detail_url&limit=10";
        doCORSRequest({
          method: 'GET',
          url: newgameUrl,
          data: ""
        }, function printResult(result) {
            
        console.log("HERE IS THE RESULTT");

          console.log(result);
            console.log("FAILS HERE");
          var json = JSON.parse(result);
          var gameList = [];
          console.log(json.results[0].name);
          for(i = 0 ; i < json.results.length ; i++)
          {
              console.log(json.results[i].name);
              gameList.push(json.results[i].name);
          }

          awesomplete.list = gameList;


          document.getElementById("name").focus();
        });
      }, 1000);
      document.getElementById("name").focus();
      // var script = document.createElement('script');
      // script.src = gamesListUrl;
      //
      // document.getElementsByTagName('head')[0].appendChild(script);
      // var xhttp = new XMLHttpRequest();
      // xhttp.onreadystatechange = function() {
      //   if (xhttp.readyState == 4 && xhttp.status == 200) {
      //     //document.getElementById("demo").innerHTML = xhttp.responseText;
      //     console.log(xhttp.responseText);
      //   }
      // };
      // xhttp.open("GET", gamesListUrl, true);
      // xhttp.send();

    }

function reset(){
console.log("In reset");
    
document.getElementById("name").value='';
document.getElementById("platform").value='';
document.getElementById("price").value='';


    
}




