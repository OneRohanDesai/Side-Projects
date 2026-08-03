import os
import json
import boto3

sns_arn = os.environ['SNS_TOPIC_ARN']
sns = boto3.client('sns')

def lambda_handler(event, context):
    try:
        body = event.get('body') or json.dumps(event)
        if isinstance(body, str):
            payload = body
        else:
            payload = json.dumps(body)
        sns.publish(TopicArn=sns_arn, Message=payload, Subject="Alertmanager notification")
        return {"statusCode": 200, "body": "OK"}
    except Exception as e:
        return {"statusCode": 500, "body": str(e)}
