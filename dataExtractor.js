// Send request to extension to see if its online
var request = {request: "available"};
chrome.extension.sendRequest(request, initializeRequest);

// Start up the data extraction
function initializeRequest(response)
{
	extOnline = response.status; // Do I?
	var titlesEle = {};

	// Check if extension is online
	if(extOnline == "yes")
	{
		// Setting up listeners
		$(document).ready(pageReady); // We are ready
		$(window).delegate(".title a", 'click', titleClick);// Add a listener to listen for clicks on the elements
		$(window).bind('beforeunload', pageUnload); // On unload, tell extension to remove our articles
		
		function pageReady(event)
		{
			///// Data Extraction
			// Extract titles from page, except the more link
			titlesEle = $('.title a').slice(0, -1);
			var articleData = []; // Array of objects is better
			
			// Extract titles
			$(titlesEle).each(function(){
				var titleElement = $(this);
				articleData.push({title: normalizeString(titleElement.text()), link: titleElement.attr('href')});
			});
			
			// Store articles from current tab
			chrome.extension.sendRequest({request: "addTabData", data: articleData});
			// Send the titles to the classifier
			chrome.extension.sendRequest({request: "classify", data: articleData}, classify);
		}
		
		function classify(response)
		{
			var articleElements = titlesEle;
			// Response will consist of title indices that have been labeled interesting
			var titleIndices = response.titleIndices;
			var recTextColors = response.textColors;
			var recBackColors = response.highlightColors;
			
			$.each(titleIndices, function(index){
				// Change color
				$(articleElements[titleIndices[index]]).css({backgroundColor: recBackColors[index], color: recTextColors[index]});
			});
		}
		
		function titleClick(event)
		{
			var element = $(this);
			// If we clicked the more button to process dataset
			if( element.text() === "More" )
			{
				chrome.extension.sendRequest({request: "train"});
				return; // Nothing more needs to be done.
			}
			
			// We've clicked on an article, so label as interesting
			var textNormalized = normalizeString(element.text());
			var link = element.attr('href');
			chrome.extension.sendRequest({request: "label", dataPoint: {title: textNormalized, link:link, label: 1}});
			
			event.preventDefault(); // Yeah....
			window.open(link, '_newtab');
		}
		
		function pageUnload(event)
		{
			// Remove the stored tab's data
			chrome.extension.sendRequest({request: "removeTabData"});
		}
	}
}

function removePunc(str){
	return str.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ");
}

function normalizeString(str)
{
	return removePunc(str).toLowerCase();
}