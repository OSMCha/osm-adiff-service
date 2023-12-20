sed 's/,/\n/' backfill.txt | while read -r field
do
	if aws s3 ls "s3://mapbox/real-changesets/production/$field.json" | grep "$field" 
	then 
		echo "Already present $field"
	else
		node backfill production "$field"
	fi
done