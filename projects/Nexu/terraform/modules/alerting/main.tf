resource "aws_sns_topic" "alerts" {
  name = "${var.project}-${var.env}-alerts"
}

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project}-${var.env}-alert-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "lambda_sns_publish" {
  name = "lambda-sns-publish"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = ["sns:Publish"],
      Effect = "Allow",
      Resource = aws_sns_topic.alerts.arn
    },{
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      Effect = "Allow",
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

resource "aws_lambda_function" "alert_webhook" {
  filename         = "${path.module}/alert_webhook.zip" # build & zip from local python handler
  function_name    = "${var.project}-${var.env}-alert-webhook"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = filebase64sha256("${path.module}/alert_webhook.zip")
  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
    }
  }
}

resource "aws_api_gateway_rest_api" "alerts_api" {
  name = "${var.project}-${var.env}-alert-api"
}

resource "aws_api_gateway_resource" "alerts_resource" {
  rest_api_id = aws_api_gateway_rest_api.alerts_api.id
  parent_id   = aws_api_gateway_rest_api.alerts_api.root_resource_id
  path_part   = "alert"
}

resource "aws_api_gateway_method" "post_method" {
  rest_api_id   = aws_api_gateway_rest_api.alerts_api.id
  resource_id   = aws_api_gateway_resource.alerts_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration" {
  rest_api_id = aws_api_gateway_rest_api.alerts_api.id
  resource_id = aws_api_gateway_resource.alerts_resource.id
  http_method = aws_api_gateway_method.post_method.http_method
  integration_http_method = "POST"
  type = "AWS_PROXY"
  uri  = aws_lambda_function.alert_webhook.invoke_arn
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_webhook.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.alerts_api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [aws_api_gateway_integration.lambda_integration]
  rest_api_id = aws_api_gateway_rest_api.alerts_api.id
  description = "Deployment for Nexu alert webhook"
}

resource "aws_api_gateway_stage" "prod" {
  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.alerts_api.id
  deployment_id = aws_api_gateway_deployment.deployment.id
}

output "alert_webhook_url" {
  value = "https://${aws_api_gateway_rest_api.alerts_api.id}.execute-api.${var.aws_region != null ? var.aws_region : "ap-south-1"}.amazonaws.com/${aws_api_gateway_stage.prod.stage_name}/alert"
}
