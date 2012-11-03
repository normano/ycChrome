// Send request to extension to see if its online
var request = {request: "available"};
chrome.extension.sendMessage(request, initializeRequest);

// Start up the data extraction
function initializeRequest(response)
{
	extOnline = response.status; // Do I?
	var titlesEle = {};
	var websites = {
		'newsAtYC': {'regExp': new RegExp("news.ycombinator.com", "i")},
		'reddit': { 'regExp': new RegExp("reddit.com", "i")}
	};

	// Check if extension is online
	if(extOnline == "yes")
	{
		// Setting up listeners
		$(document).ready(pageReady); // We are ready
		$(window).delegate(".title>a", 'click', titleClick);// Add a listener to listen for clicks on the elements
		
		// Reddit
		if(window.document.documentURI.match(websites.reddit.regExp))
		{
			$(window).delegate(".nextprev>a", 'click', trainClick);// Reddit specific listener
		}
		$(window).bind('beforeunload', pageUnload); // On unload, tell extension to remove our articles
		
		
		
		function pageReady(event)
		{
			var docURI = window.document.documentURI;
			///// Data Extraction
			// Extract titles from page			
			// newsYC specific
			if(docURI.match(websites.newsAtYC.regExp))
			{
				// except the more link
				titlesEle = $('.title>a').slice(0, -1);
			}
			else if(docURI.match(websites.reddit.regExp))
			{
				titlesEle = $('.sitetable .title>a')
			}
			
			var articleData = []; // Array of objects is better
			
			// Extract titles
			$(titlesEle).each(function(){
				var titleElement = $(this);
				articleData.push({title: normalizeString(titleElement.text()), link: titleElement.attr('href')});
			});
			
			// Store articles from current tab
			chrome.extension.sendMessage({request: "addTabData", data: articleData});
			// Send the titles to the classifier
			chrome.extension.sendMessage({request: "classify", data: articleData}, classify);
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
				trainClick();
				return; // Nothing more needs to be done.
			}
			
			// We've clicked on an article, so label as interesting
			var textNormalized = normalizeString(element.text());
			var link = element.attr('href');
			chrome.extension.sendMessage({request: "label", dataPoint: {title: textNormalized, link:link, label: 1}});
			
			event.preventDefault(); // Yeah....
			window.open(link, '_blank');
		}
		
		function pageUnload(event)
		{
			// Remove the stored tab's data
			chrome.extension.sendMessage({request: "removeTabData"});
		}
		
		/* Send message to extension to train on data set*/
		function trainClick()
		{
			chrome.extension.sendMessage({request: "train"});
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