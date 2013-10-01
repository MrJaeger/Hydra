WebRTC-ManyToManyVideoChat
==========================

Many to Many video chat, can "theoretically" support an infinite number of connections

#What it does

This projects allows for people to visit to a webpage and have them all connected for a video chat via WebRTC.  It uses an intermediate node server to setup these connections and then from there it's all done through the browser!

#How to run

1.  Clone the repo somewhere  
```
git clone git@github.com:MrJaeger/WebRTC-ManyToManyVideoChat.git
```

2.  Install the dependencies using npm  
```
npm install -d
```

3.  Run the server  
```
node server.js
```

4.  Open as many tabs as you want pointing to 'localhost:3000' and see what happens!

#Credit where credit is due

This project is heavily based off of the [HTML5Rocks Demo](http://www.html5rocks.com/en/tutorials/webrtc/basics/), which despite being over a year old is an amazing resource.  If you want to find out more about WebRTC I would definitely suggest checking that out or the official WebRTC standard [here](http://www.w3.org/TR/2013/WD-webrtc-20130910/)
	
