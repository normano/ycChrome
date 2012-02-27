function removePunc(str){
	return str.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ");
}

function normalizeString(str)
{
	return removePunc(str).toLowerCase();
}

// When more link is pressed
function processData(elements){
	var linkList = elements.attr('href');
	// Let's go through the titles
	elements.each(function(index){
		var sTitle = normalizeString($(this).html());
		var hash = hex_md5(sTitle+linkList[index]);
		var allHashes = $.merge($.merge([], classObjs['notInterested'].hashes), classObjs['interested'].hashes);
		
		// Make sure we've never seen the title before
		if($.inArray(hash, allHashes) < 0 )
		{
			// Label the data as not interested
			hnClassifier.label(hash, 0);
			
			// Add title to titles list
			classObjs['notInterested'].titleList.push(sTitle);
		}
	});
};

var NaiveBayesText = function(){
	var classObjs;
	
	// Send request to background page
	chrome.extension.sendRequest({request: "localStorage", op:"get", key:"classObjs"}, 
		function(response){
			classObjs = this.classObjs = JSON.parse(response.classObjs);
			
			// Start off the classification process
			$(window).trigger('dataAvailable');
		}
	)
	
	// I question some of my decisions made in the data structure.
	this.getClassObjs = function(){
		return classObjs;
	}
	
	this.label = function(hash, label){
		// Will probably use this for aggregated data some day
		//	labelData[hash] = label;
		
		// For now we have two lists
		if(label === 1)
		{
			labelName = "interested"
		}
		else
		{
			labelName = "notInterested"
			label = 0; // Enforce not interested label
		}	
		
		classObjs[labelName].hashes.push(hash);
	}
	
	this.classify = function(sentence){
		var wordList = normalizeString(sentence).split(' ');
		var classPredProb = [];
		var decisionLabel = 0;
		var totalHashCount = {'total': 0}; // Total number of hashes in each class
		var totalWordCount = {'total': 0}; // Total counts for class
		var wc = {}; // Total word count for each word regardless of class
		var totalVocabulary = 0;
		
		
		// Go through the classes to calculate some statistics
		$.each(classObjs, function(className, classObj){
			// Count Hashes
			(totalHashCount[className]) ? (totalHashCount[className] += classObj.hashes.length) : totalHashCount[className] = classObj.hashes.length;
			
			totalHashCount.total += classObj.hashes.length;
			
			// Count words
			$.each(classObj.wordCounts, function(wordLabel, wordCount){
				(totalWordCount[className]) ? totalWordCount[className] += wordCount : totalWordCount[className] = wordCount;
				(wc[wordLabel]) ? wc[wordLabel]+=wordCount : wc[wordLabel]=wordCount;
				totalVocabulary++;
				totalWordCount.total += wordCount;
			});
			
		});

		//console.log(totalHashCount, totalWordCount);
		
		// Go through classes to start classification
		$.each(classObjs, function(className, classObj){
			// Calculate probabilities
			var probability = 1; // P(class | sentence)
			var weight = 1;
			var priorClass = (totalHashCount[className]+1)/(totalHashCount['total']+2);
			
			// We need to weight our stories
			weight = ((className === "notInterested") ? .3 : 4)
			
			// Figure out probabilites of classes using the words
			$.each(wordList, function(index){
				// If the word exists then perfecto, else it has no reason being here, I could be wrong.
				if(classObj.wordCounts[wordList[index]])
				{
					// log(P(word | classLabel))
					var probWord = Math.log((classObj.wordCounts[wordList[index]]/wc[wordList[index]])); // Rel. frequency of term in class
					
					probability += probWord; // sum up
				}
			});
			
			probability += Math.log(priorClass*weight); // sum up
			
			classPredProb.push(probability); // Finished, final probability for class
		});
		
		
		//console.log(classPredProb, Math.max.apply(null, classPredProb));
		
		// Find class with the maximum probability
		decisionLabel = $.inArray(Math.max.apply(null, classPredProb), classPredProb);
		
		return decisionLabel;
	}

	this.train = function(){
		// Iterate through classes and calculate probablities
		$.each(classObjs, function(className, classObj){
			var allTitles = "";
			var titleList = classObj.titleList;
			var titlesCount = titleList.length;
			
			// Iterate through titles list
			$.each(titleList, function(index){
				var sTitle = normalizeString(titleList[index]); // Sanitize
				// Aggregate titles
				allTitles = allTitles + sTitle + ((index+1 != titlesCount) ? " ": "");
			});
			
			var titleWordList = allTitles.split(' ');
			var totalTitleWords = titleWordList.length;
			
			
			// Count the words
			titleWordList.map(function(word){
				(classObj.wordCounts[word]) ? (classObj.wordCounts[word]++) : classObj.wordCounts[word] = 1;
			});
			
			// Clear Title List
			classObj.titleList = [];
		});
	}
	
	$(window).bind('beforeunload', function(event){
		// Save for persistence
		if(hnClassifier === undefined) return;
		chrome.extension.sendRequest({request: "localStorage", op:"set", key:"classObjs", value: JSON.stringify(hnClassifier.getClassObjs())}, 
			function(response){
			// Nil
			}
		)
	});
};

var extOnline = false;
var hnClassifier = new NaiveBayesText();
$(window).bind('dataAvailable', function(){
	// Send request to extension to see if its online
	chrome.extension.sendRequest({request: "available"}, function(response){
		extOnline = response.status;

		// Check if extension is online
		if(extOnline == "yes")
		{
			// Data Extraction
			
			// Extract titles from page, except the more link
			var titlesEle = $('.title a').slice(1, -1);
			var titlesCount = titlesEle.length;
			var classObjs = hnClassifier.getClassObjs(); // naming compatibility
			var enoughData = ($.merge($.merge([], classObjs['notInterested'].hashes), classObjs['interested'].hashes).length >= 60);
			
			// Try to classify
			$(titlesEle).each(function(){
				var element = $(this);
				var title = element.text();
				
				// We need enough data in order ot do anything.
				if(enoughData == true)
				{
					var decision = hnClassifier.classify(title);
					
					// Lets see if it works
					if(decision == 1)
					{
						// Change color
						element.css({backgroundColor: "#C03010", color: "#FFF"});
					}
				}	
			});

			// debug information
			//console.log(classObjs);

			// Add a listener to listen for clicks on the elements
			$(window).delegate(".title a", 'click', function(event){
				// If we clicked the more button process dataset
				if( $(this).text() === "More")
				{
					// Process dataset
					processData(titlesEle);
					
					// Train classifier
					hnClassifier.train(classObjs);
					
					return; // Get out of here
				}
				
				// create hash from title and link
				var link = $(this).attr('href');
				var sTitle = normalizeString($(this).html());
				var hash = hex_md5(sTitle+link);
				
				// Have we been interested in this before?
				if($.inArray(hash, classObjs['interested'].hashes ) < 0)
				{
					// Label the data
					hnClassifier.label(hash, 1);
				
					// Add to titles list
					classObjs['interested'].titleList.push(sTitle);
				}
				
				// Debug information
				//console.log(classObjs['interested'].hashes[hash], sTitle);	
			});
		}
	});
})
