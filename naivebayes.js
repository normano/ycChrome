// General naive bayes implementation for my purposes
var NaiveBayesText = function(classObjs, weights){
	var totalHashCounts = {'total': 0}; // Total number of hashes in each class
	var totalWordCounts = [];
	var totalUWC = {}; // Total word count for each word regardless of class
	var totalFeatures = 0; // Total vocabulary for our purposes
	var labels = [];
	var hashes = [];
	var wordCounts = [];
	
	// On startup
	// Will probably make this part of the object prototype so it can be overridden
	var init = function(){
		// Go through the classes to calculate some statistics
		$.each(classObjs, function(className, classLabel){
			// Deconstruct class object
			labels.push(className); // Push the name of the class
			hashes.push(classLabel.hashes);
			wordCounts.push(classLabel.wordCounts);
			
			// Add hash count
			classHashCount = classLabel.hashes.length;
			(totalHashCounts[className]) ? (totalHashCounts[className] += classHashCount) : totalHashCounts[className] = classHashCount;
			totalHashCounts.total += classHashCount;
			
			// Count words
			$.each(classLabel.wordCounts, function(wordLabel, wordCount){
				(totalUWC[wordLabel]) ? totalUWC[wordLabel]+=wordCount : totalUWC[wordLabel]=wordCount;
				totalFeatures++; // Counting unique words
			});
			
		});
	}
	
	this.dataCount = function(){
		return totalHashCounts.total;
	};
	
	this.getClassObj = function(){
		// Reconstruct class object
		resultObj = {};
		$.each(labels, function(index){
			resultObj[labels[index]] = {'wordCounts': wordCounts[index], 'hashes': hashes[index]};
		});
		
		return resultObj;
	}
	
	// Returns bool, values indicates whether it exists or not
	this.dataExists = function(hash)
	{
		return ($.inArray(hash, hashes.reduce(function(a,b){return $.merge($.merge([],a),b)})) >= 0)
	}
	
	this.label = function(hash, label){		
		// Make sure label chosen is correct
		if(label >= labels.length)
		{
			label = 0; // Enforce not interested label
		}
		
		hashes[label].push(hash); // Adding hash
		totalHashCounts.total++; // Increment hash count
	}
	
	this.classify = function(sentence){
		var wordList = sentence.split(' ');
		var classPredProb = [];
		var decisionLabel = 0;
		var totalVocabulary = 0;
		
		// Go through classes to start classification
		$.each(labels, function(classIndex){
			var className = labels[classIndex]
			// Calculate probabilities
			var probability =  0; // P(class | sentence)
			var weight = 1;
			var priorClass = (totalHashCounts[className]+1)/(totalHashCounts['total']+2);

			/////// FEATURE: Feature limiting
			/////// Interested in looking towards avg(totalWordCount/uniqueWC) to figure out what the avg word count is for the class
			var classStats = new classStatistics(wordCounts[classIndex]);
			
			// We need to weight our stories
			weight = weights[classIndex];
			
			// Figure out probabilites of classes using the words
			$.each(wordList, function(wIndex){
				// If the word exists then perfecto, else it has no reason being here, I could be wrong.
				if(wordCounts[classIndex][wordList[wIndex]])
				{
					var wordCount = wordCounts[classIndex][wordList[wIndex]];
					var probWord = 0;

					////// Once we have the avg, we can look at how far away the current word count we have using z scores
					var zScore = (wordCount - classStats.wordMean)/classStats.wordStdDev;
					
					// Make sure word in sentence is is somewhat related
					if((zScore >= -1.5) && (zScore <= 1.5))
					{
					// Debug
					//console.log('Mean: ' + classStats.wordMean + ' Var: ' + classStats.wordVariance + ' z-Score: '+ zScore);
						// log(P(word | classLabel))
						probWord = (Math.log(wordCount) - Math.log(totalUWC[wordList[wIndex]])); // Rel. frequency of term in class
					}
					else
					{
						// Can assign penalty
						probWord = 0;
					}
					
					probability += probWord; // sum up
				}
			});
			
			probability += Math.log(priorClass)+ Math.log(weight); // sum up
			
			classPredProb.push(probability); // Finished, final probability for class
		});

		// Debug purposes
		console.log(classPredProb);
		
		// Find class with the maximum probability
		decisionLabel = $.inArray(Math.max.apply(null, classPredProb), classPredProb);
		
		return decisionLabel;
	}

	this.train = function(textData){
		var countWords = function(wordList, classLabel){
			// Count the words
			wordList.map(function(word){
				// increment wordcount by one or create feature
				if(wordCounts[classLabel][word])
				{
					// Word exists already
					wordCounts[classLabel][word]++;
					totalUWC[word]++;
				}
				else
				{
					wordCounts[classLabel][word] = 1;
					totalFeatures++; // increase total word count
					totalUWC[word] = 1;
				}
			});
		}

		// Starts here
		if(textData instanceof Array)
		{
			// For now we assume any array of data is data we are not interested in
			textData.map(function(text){
				var titleWordList = text.split(' ');
				countWords(titleWordList, 0);
			});
		}
		else if((typeof textData) === 'string')
		{
			// Assume data is what we are interested in
			
			// Make a word list from the title
			var titleWordList = textData.split(' ');
			countWords(titleWordList, 1);
		}
	}
	
	this.processData = function(elements){
		// Let's go through the titles
		$.each(elements, function(index){
			var sTitle = elements[index].title;
			var link = elements[index].link;
			var hash = hex_md5(sTitle+link);
			var allHashes = $.merge($.merge([], classObjs['notInterested'].hashes), classObjs['interested'].hashes);
			
			// Make sure we've never seen the title before
			if($.inArray(hash, allHashes) < 0 )
			{
				// Label the data as not interested
				this.label(hash, 0);
				
				// Add title to titles list
				classObjs['notInterested'].titleList.push(sTitle);
			}
		});
	}
	
	function classStatistics(wordCounts)
	{
		this.wordMean = 0; // E(X)
		this.wordVariance = 0;
		this.wordStdDev = 0; // Root of the Means of the Squared deviations
		
		if(wordCounts instanceof Array)
		{
			if(wordCounts.length > 0)
			{
				var wordMean = this.wordMean = wordCounts.reduce(function(count1,count2){ return count1+count2 })/wordCounts.length;
				
				
				var squaredDeviations = wordCounts.map(function(count){ var squaredDeviation = Math.pow(count - wordMean, 2); return squaredDeviation;});
				
				var meanDeviation = squaredDeviations.reduce(function(sDev1, sDev2){ return sDev1+sDev2 })/wordCounts.length;
				
				this.wordVariance = meanDeviation;
				
				this.wordStdDev = Math.sqrt(meanDeviation);
			}
		}
		else if(wordCounts instanceof Object)
		{
			var wordCountsList = [];
			$.each(wordCounts, function(wordName, wordCounts){
				wordCountsList.push(wordCounts);
			});
			
			return new classStatistics(wordCountsList); // Makes my life easier
		}
		
	}
	
	init(); // initialize
};