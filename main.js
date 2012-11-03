// Base data requirements
var defaultObj = {
	'notInterested': { wordCounts: {}, hashes: []}, 
	'interested': { wordCounts:{}, hashes: [] }
};
var defaultClassifier = function(dataObj){};

///// Load from IndexedDB
var dbVersion = 2;
var indexedDB = window.indexedDB || window.webkitIndexedDB;
var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
var dbReq = indexedDB.open('newsRecommender');
var newsRecDB = null;

// Load from Local storage
var online = localStorage.getItem('exCROnline');
var recTextColor = localStorage.getItem('recTextColor');
var recHighTextColor = localStorage.getItem('recHighColor');
var visitedText = localStorage.getItem('visitedColor'); // Looking to see if I can/want to add this
var readFreq = localStorage.getItem('readFreq');
var weights = [];
var websites = [
  {'key': 'newsAtYC', 'regExp': new RegExp("news.ycombinator.com", "i"), 'classObjs': {}, 'classifier': defaultClassifier},
  {'key': 'reddit', 'regExp': new RegExp("reddit.com", "i"), 'classObjs': {}, 'classifier': defaultClassifier}
];
var tabsArticleData = {}; // Support for multiple tabs

// Attach db handlers
dbReq.onupgradeneeded = dbVersionChange;
dbReq.onsuccess = function(event){

	// Grab db object and initalize the extension
	newsRecDB = dbReq.result;
	initalize();
	
	/* DEBUG ONLY
	// Read database from IndexedDB
	var dbTrans = newsRecDB.transaction(['websites']);

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
	var websitesStore = {};
	
	var newsRecDB = event.target.result;
	if(!newsRecDB.objectStoreNames.contains('websites'))
	{
		///// Create datastore
		// Possible point of expanding the extension, which is why this is named this way
		websitesStore = newsRecDB.createObjectStore("websites", {keyPath: "name"});
	}
	else
	{
		websitesStore = newsRecDB.transaction(['websites'], "readwrite").objectStore("websites");
	}
	
	// Add supported websites with the default object
	for(websiteIndex in websites)
	{
//TODO: Need a way to check if the website already exists
		var key = websites[websiteIndex].key;
		websitesStore.add({name: key, data: defaultObj});
	}
	
	// Let's notify user of a welcome message
	var notification = webkitNotifications.createNotification(
	  'icon.png',  // icon url - can be relative
	  'First Run!',  // notification title
	  "Thank you for installing me! \
	   It is required that you click some articles and go through two pages (press the 'more' link twice) in hacker news to train me! \
	   Have Fun!"  // notification body text
	);
	
	notification.show(); // Show that shiz
	
	// Close after awhile
	setTimeout(function(){notification.cancel()}, 10000);
}

function initalize()
{
	// Attach listeners
	chrome.tabs.onUpdated.addListener(tabUpdated);
	chrome.pageAction.onClicked.addListener(clickedPageAction);
	chrome.extension.onMessage.addListener(sendRequestHandler);
	
	///// Start sanity checks
	if(online === null)
	{
		localStorage.setItem('exCROnline', 'yes');
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
		
	dbTrans.onerror = function(event){
		// Handle this somehow
		// Potentially throw an exception
	};
	
	// Finally we can start
	weights = getWeights(readFreq);
	$.each(websites, function(index){
		var website = websites[index];
		var objStoreGet = dbTrans.objectStore('websites').get(website.key);
		objStoreGet.onsuccess = function(event){
			var website = websites[index];
			// Load in structure for website
			website.classObjs = event.target.result.data;
			
			// Start the classifier
			website.classifier = new NaiveBayesText(website.classObjs, weights);
			//console.log(website.classifier.getClassObj()); // Debug purposes
		}
	});
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
	
	localStorage.setItem('exCROnline', online);
}

function tabUpdated (tabId, changeInfo, tab){
	var showIcon = false;
	
	// Should we show the icon?
	$.each(websites, function(index){
		var website = websites[index];
		if(tab.url.match(website.regExp))
			showIcon = true;
	});
	if(showIcon)
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
	var exClassifier = null;
	var websiteKey = '';
	var websiteClassObjs = {};
	var tabUrl = sender.tab.url;
	
	// Find which website data we need
	$.each(websites, function(index){
		if(tabUrl.match(websites[index].regExp) !== null)
		{
			var website = websites[index];
			websiteKey = website.key;
			websiteClassObjs = website.classObjs;
			exClassifier = website.classifier;
			return false;
		}
	});
	
	if(exClassifier === null) return;
	
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
				localStorage.setItem('exCROnline', online);
			}
		break;
		case "classify":
			// Base data
			var articleData = messageData.data;
			response.titleIndices = [];
			response.textColors = [];
			response.highlightColors = [];
			
			// We need enough data before we can classify
			var trainedCount = exClassifier.dataCount();
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
				var decision = exClassifier.classify(title);
				
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
				if(!exClassifier.dataExists(hash))
				{
					finalResultSet.push(article.title);
					exClassifier.label(hash, 0);
				}
			});
			exClassifier.train(finalResultSet); // Array 
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
			if(!exClassifier.dataExists(hash))
			{
				// Label the data
				exClassifier.label(hash, label);
				exClassifier.train(sTitle);
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
			  The intention is to save the classObjs whenever a tab is closed
			  IDEALLY, it would be when the extension is closed or unloading, but chrome is finicky with 
			  that so here we are.
			*/
			
			dbSaveClassObjs(websiteKey, websiteClassObjs);
		break;
		case "resetColData":
			// First clear the class object then reinitialize.
			tabsArticleData = {};
			
			// Clear the data in the db
			$.each(websites, function(index){
				var key = websites[index].key;
				var classObjs = websites[index].classObjs = defaultObj;
				websites[index].exClassifier = new NaiveBayesText(classObjs, weights);
				dbSaveClassObjs(key, classObjs);
			});
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
			classObjs = exClassifier.getClassObj(); // Save for now
			exClassifier = new NaiveBayesText(classObjs, weights); // Reinitialize
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
	var dbTrans = newsRecDB.transaction(['websites'], "readwrite").objectStore('websites');
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