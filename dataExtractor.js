function removePunc(str){
	return str.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ");
}

function normalizeString(str)
{
	return removePunc(str).toLowerCase();
}

// Send request to extension to see if its online
chrome.extension.sendRequest({request: "available"}, function(response){
	extOnline = response.status;

	// Check if extension is online
	if(extOnline == "yes")
	{
		// Data Extraction
		
		// Extract titles from page, except the more link
		var titlesEle = $('.title a').slice(0, -1);
		
		var articleData = []; // Array of objects is better
		$(titlesEle).each(function(){
			var titleElement = $(this);
			articleData.push({title: normalizeString(titleElement.text()), link: titleElement.attr('href')});
		})
		
		// create hash from title and link
		// When we go to the page, tell extension toadd our articles
		$(document).ready(function(event){
			// Store articles from current tab
			chrome.extension.sendRequest({request: "addTabData", data: articleData});
		});
		
		// This may be redundant..., look towards pushing this functionality to the onload event
		// Send these titles to the classifier
		chrome.extension.sendRequest({request: "classify", data: articleData}, 
			function(response){
				var articleElements = titlesEle; // Not sure why I named this titlesEle
				// Response will consist of title indices that have been labeled interesting
				var titleIndices = response.titleIndices;
				
				$.each(titleIndices, function(index){
					// Change color
					$(articleElements[titleIndices[index]]).css({backgroundColor: "#C03010", color: "#FFF"});
				});
			}
		);
		
		// Add a listener to listen for clicks on the elements
		$(window).delegate(".title a", 'click', function(event){
		
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
			
			//event.preventDefault(); // Debugging purposes			
		});
		
		// On unload, tell extension to remove our articles
		$(window).bind('beforeunload', function(event){
			// Send title elements for training
			chrome.extension.sendRequest({request: "removeTabData"});
		});
	}
});