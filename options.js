$(document).ready(function(){
	var extOnline = localStorage.getItem('exCROnline');
	
	// Reading Frequency
	var readFreq = localStorage.getItem('readFreq');
	$('input[name="readFreq"][value='+readFreq+']').attr('checked', true); // Find currently selected and check it
	$('input[name="readFreq"]').change(function(){
		readFreq = $(this).val();
		$('input[name="readFreq"]').attr('checked', false); // Uncheck all
		chrome.extension.sendMessage({request: 'changeReadFreq', readFreq: readFreq}, function(){
			alert('Read Frequency changed successfully.');
			$('input[name="readFreq"][value='+readFreq+']').attr('checked', true);
		});
	});

	// Colors
	var recText = localStorage.getItem('recTextColor');
	var recHighText = localStorage.getItem('recHighColor');
	var visitedText = localStorage.getItem('visitedColor');
	
	$('input[name="recText"]').val(recText);
	$('input[name="recHighText"]').val(recHighText);
	$('input[name="visitedText"]').val(visitedText);
	
	// Color changing
	$('input[name="recText"], input[name="recHighText"], input[name="visitedText"]').change(function(){
		var colorField = $(this).attr('name');
		var colorVal = $(this).val();
		
		alert("Changed color");
		//chrome.extension.sendMessage({request:'changeColor', type: colorField, color:colorVal});
	});
	
	var toggleOnlineStatus = function(){
		if(getOnlineStatus() === "yes")
		{
			$('#recommenderSwitch').text('Turn Off Recommender');
		}
		else
		{
			$('#recommenderSwitch').text('Turn On Recommender');
		}
	}
	
	var getOnlineStatus = function(){
		return extOnline;
	}

	$('#recommenderSwitch').click(function(){
		extOnline = ((extOnline === "yes") ? "no" : "yes");
		localStorage.setItem('exCROnline', extOnline);
		toggleOnlineStatus();
		chrome.extension.sendMessage({request:"available", value:extOnline});
	});

	$('#removeCollectedData').click(function(){
		var confirm = window.confirm("You are about to reset the data you've collected.");
		
		if(confirm)
		{
			chrome.extension.sendMessage({request:"resetColData"}, function(response){
				alert("Data has been reset.");
			});
		}
	});

	// Set button's text status
	toggleOnlineStatus();
});