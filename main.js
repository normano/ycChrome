// Base data requirements
var defaultObj = {
	'notInterested': { wordCounts: {}, hashes: []}, 
	'interested': { wordCounts:{}, hashes: [] }
};
var hnClassifier = null;

///// Load from IndexedDB
var dbVersion = 0.1;
var indexedDB = window.indexedDB || window.webkitIndexedDB;
var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
var dbReq = indexedDB.open('newsRecommender', dbVersion);
var newsRecDB = null;

// Load from Local storage
var online = localStorage.getItem('hnNROnline');
var recTextColor = localStorage.getItem('recTextColor');
var recHighTextColor = localStorage.getItem('recHighColor');
var visitedText = localStorage.getItem('visitedColor'); // Looking to see if I can/want to add this
var classObjs = localStorage.getItem('classObjs'); // A relic, will remove in v0.5
var readFreq = localStorage.getItem('readFreq');
var weights = [];
var newsUrl = new RegExp("news.ycombinator.com", "i");
var tabsArticleData = {}; // Support for multiple tabs

// Attach db handlers
dbReq.onsuccess = function(event){
	newsRecDB = dbReq.result;
	//console.log(newsRecDB); // debug only
	
	// Assuming this works eventually
	newsRecDB.onversionchange = dbVersionChange;
	
	// Until the above works, we can use this
	if(newsRecDB.version != dbVersion){
		// Assuming this function is not removed in later versions
		if(newsRecDB.setVersion)
		{
			var setV = newsRecDB.setVersion(dbVersion);
			setV.onsuccess = dbVersionChange;
		}
	}
	initalize();
	
	/* DEBUG ONLY
	// Read database from IndexedDB
	var dbTrans = newsRecDB.transaction(['websites']);
	
	dbTrans.oncomplete = function(event){
		// Not sure what to do yet
	};
	
	dbTrans.onerror = function(event){
		// Handle these somehow
	};
	var objStoreGet = dbTrans.objectStore('websites').get('newsAtYC');
	objStoreGet.onsuccess = function(event){
		classObjs = event.target.result; // :) Good stuff, hmm i actually kind of hate it haha
		console.log(classObjs);
	}
	*/
}

dbReq.onerror = function(){
	alert("Unfortunately, the HH News Recommender could not open a database. It is suggested that you restart the browser to try again or contact the creator with this Error Code: "+event.target.errorCode);
}

function dbVersionChange(event)
{
//TODO: Will have to handle the issue of rollbacks incase of an error
	var objStore = {};
	if(!newsRecDB.objectStoreNames.contains('websites'))
	{
		// Using this the wrong way, but I'm lazy right now and this db async stuff is weird.
		// I like blocked for small things like this
		///// Create datastore
		// Possible point of expanding the extension, which is why this is named that way
		objStore = newsRecDB.createObjectStore("websites", {keyPath: "name"});
		
	}
	else
	{
		objStore = newsRecDB.transaction(['websites'], IDBTransaction.READ_WRITE).objectStore("websites");
	}
	
	//console.log(objStore);
	
	objStore.onsuccess = function(event){
		
		// Check if classObj exists
		if((classObjs === null) || (classObjs === 'undefined')){
			//classObjs = defaultObj;
			// Save it ... not needed now
			//localStorage.setItem('classObjs', JSON.stringify(classObjs));
		}
		else
		{
			// Turn into JSON object
			classObjs = JSON.parse(classObjs);
			
			// Delete item from localStorage
			localStorage.removeItem('classObjs');
			
			// Then store into indexedDB, this is the transition point
			objStore.add({name: "newsAtYC", data: classObjs});
		}
		
		// Make sure this thing exists
		var newsYCData = objStore.get('newsAtYC');
		newsYCData.onerror = function(event){
			// If it doesn't exist create it
			objStore.add({name: "newsAtYC", data: defaultObj});
		}
	}
	
	// Let's notify user of a welcome message
	var notification = webkitNotifications.createNotification(
	  'icon.png',  // icon url - can be relative
	  'First Run!',  // notification title
	  "Hey! Thanks for installing me! \
	   If you haven not already (since you've installed me), it is required that you go through two pages (press the 'more' link twice) in hacker news to train me! \
	   Have Fun!"  // notification body text
	);
	
	notification.show(); // Show that shiz
	
	// Close after awhile
	setTimeout(function(){notification.cancel()}, 15000);
}

function initalize()
{
	// Attach listeners
	chrome.tabs.onUpdated.addListener(tabUpdated);
	chrome.pageAction.onClicked.addListener(clickedPageAction);
	chrome.extension.onRequest.addListener(sendRequestHandler);
	
	///// Start sanity checks
	if(online === null)
	{
		localStorage.setItem('hnNROnline', 'yes');
	}

	if(recTextColor === null)
	{
		recTextColor = '#FFF';
		localStorage.setItem('recTextColor', recTextColor);
	}

	if(recHighTextColor === null)
	{
		recHighTextColor = '#8F1008';
		localStorage.setItem('recHighColor', recHighTextColor);
	}

	if(visitedText === null)
	{
		visitedText = '#2775B9';
		localStorage.setItem('visitedColor', visitedText);
	}

	if(readFreq == null)
	{
		readFreq = 2;
		localStorage.setItem('readFreq', readFreq);
	}
	///// End sanity checks
	
	// Read database from IndexedDB
	var dbTrans = newsRecDB.transaction(['websites']);
	
	dbTrans.oncomplete = function(event){
		// Not sure what to do yet
	};
	
	dbTrans.onerror = function(event){
		// Handle these somehow
	};
	
	// Finally we can start
	var objStoreGet = dbTrans.objectStore('websites').get('newsAtYC');
	objStoreGet.onsuccess = function(event){
		classObjs = event.target.result.data; // :) Good stuff, hmm i actually kind of hate it haha
		//console.log(classObjs);
		// Start the classifier
		weights = getWeights(readFreq);
		hnClassifier = new NaiveBayesText(classObjs, weights); // Create one single instance
		//console.log(hnClassifier.getClassObj()); // Debug purposes
	}
}

function setPageAction(tab)
{
	var iconImg = "icon.png";
	if(online === "yes")
	{
		title = "Our recommender is online!"
	}
	else
	{
		iconImg = "iconOff.png";
		title = "Offline"
	}
	chrome.pageAction.setIcon({tabId: tab.id, path: iconImg});
	chrome.pageAction.setTitle({tabId: tab.id, title: title});
}

function clickedPageAction(tab)
{
	togglePageAction();
	setPageAction(tab);
}

function togglePageAction()
{
	if(online === "yes")
	{
		online = "no";
	}
	else
	{
		online = "yes";
	}
	
	localStorage.setItem('hnNROnline', online);
}

function tabUpdated (tabId, changeInfo, tab){
	if(tab.url.match(newsUrl))
	{
		setPageAction(tab);
		if(changeInfo.status === "complete")
		{
			chrome.pageAction.show(tabId);
		}
	}
	else
	{
		//TODO: When tab is closed this is fired off? Got to check what is going on.
		chrome.pageAction.hide(tabId);
	}
}

function sendRequestHandler(messageData, sender, sendResponse){
	var response = {}
	switch(messageData.request)
	{
		case "available":
			if(!messageData.value)
			{
				response.status = online;
			}
			else
			{
				online = messageData.value
				localStorage.setItem('hnNROnline', online);
			}
		break;
		case "classify":
			// Base data
			var articleData = messageData.data;
			response.titleIndices = [];
			response.textColors = [];
			response.highlightColors = [];
			
			// We need enough data before we can classify
			var trainedCount = hnClassifier.dataCount();
			// Debug purposes
			//console.log(trainedCount);
			if(trainedCount < 60)
			{
				response.statusMessage = "There's not enough data";
				break;
			}
			
			///// send titles to extension for classification
			// Try to classify
			$.each(articleData, function(index){
				var title = articleData[index].title;
				var decision = hnClassifier.classify(title);
				
				// Lets see if it works
				if(decision === 1)
				{
					// I recommend this!
					response.titleIndices.push(index);
					response.textColors.push(recTextColor);
					response.highlightColors.push(recHighTextColor);
				}
			});
		break;
		case "train":
			var tabId = sender.tab.id;
			var tabArticleData = tabsArticleData[tabId];
			var finalResultSet = [];
			
			// Create a new array of titles we have not stored
			$.each(tabArticleData, function(index){
				var article = tabArticleData[index];
				var hash = hex_md5(article.title+article.link);
				
				// Add to result set and label it as not interested
				if(!hnClassifier.dataExists(hash))
				{
					finalResultSet.push(article.title);
					hnClassifier.label(hash, 0);
				}
			});
			hnClassifier.train(finalResultSet); // Array 
		break;
		case "label":
			// Online learning purposes only
			// May add a new field to the tabsArticleData for labeling purposesi
			
			// Base data
			var tab = sender.tab; // Use, in case we want to label the intermediate set only
			var dataPoint = messageData.dataPoint;
			var label = dataPoint.label;
			var link = dataPoint.link;
			var sTitle = dataPoint.title;
			
			// create hash from title and link
			var hash = hex_md5(sTitle+link);
			
			// Only if we've never encountered the data point before
			if(!hnClassifier.dataExists(hash))
			{
				// Label the data
				hnClassifier.label(hash, label);
				hnClassifier.train(sTitle);
			}
		break;
		case "addTabData":
			var tabId = sender.tab.id;
			tabsArticleData[tabId] = messageData.data;
		break;
		case "removeTabData":
			var tabId = sender.tab.id;
			delete tabsArticleData[tabId];
			/*
			  If someone can think of a better place to put this :(
			  The intention is to save the classObjs whenever a tab is closed
			  IDEALLY, it would be when the extension is closed or unloading, but chrome is finicky with 
			  that so here we are.
			*/
			dbSaveClassObjs('newsAtYC', classObjs);
		break;
		case "resetColData":
			// First clear the class object then reinitialize.
			classObjs = defaultObj;
			hnClassifier = new NaiveBayesText(classObjs, weights);
			tabsArticleData = {};
			
			// Clear the data in the db
			dbSaveClassObjs('newsAtYC', classObjs);
		break;
		case "changeColors":
			if(messageData.type == 'recTextColor')
			{
				recTextColor = messageData.color;
				localStorage.setItem('recTextColor', recTextColor);
			}
			else if(messageData.type == 'recHighColor')
			{
				recHighTextColor = messageData.color;
				localStorage.setItem('recTextColor', recHighTextColor);
			}
			else if(messageData.type == 'recVisitedColor')
			{
				visitedText = messageData.color;
				localStorage.setItem('visitedColor', visitedText);
			}
		break;
		case "changeReadFreq":
			readFreq = messageData.readFreq;
			weights = getWeights(readFreq);
			classObjs = hnClassifier.getClassObj(); // Save for now
			hnClassifier = new NaiveBayesText(classObjs, weights); // Reinitialize
			localStorage.setItem('readFreq', readFreq); // save read frequency
		break;
		default:
			response.statusMessage = "I don't know how to respond";
	}
	
	// If the request is asking for a response.
	if(sendResponse)
		sendResponse(response);
}

function dbSaveClassObjs(website, classObjs)
{
	//localStorage.setItem('classObjs', JSON.stringify(classObjs));
	var dbTrans = newsRecDB.transaction(['websites'],IDBTransaction.READ_WRITE).objectStore('websites');
	dbTrans.put({name: website, data: classObjs});
}

function getWeights(readFreq)
{
	var weights;
	switch(parseInt(readFreq))
	{
		case 1:
			// Casual, chances are that you want more things to read
			weights = [.7, 3];
		break;
		case 2: 
			// Average, chances that you want some things to read
			weights = [.5, 5];
		break;
		case 3:
			// Heavy, chances you want more to read
			weights = [.2, 6];
		break;
		default:
			weights = [0, 0]; // wtf is wrong with you!
	}
	
	return weights;
}