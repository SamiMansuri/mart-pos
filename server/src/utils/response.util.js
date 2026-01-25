export const getSuccessResponse = ({ message, data = null, status = 200 }) => {
  let response = {
    message,
    status: "success",
    statusCode: status,
  };
  if (data) response.data = data;
  return response;
};

export const getFailureResponse = ({message, status = "error", statusCode}) => {
  return {
    status: status,
    error: {
      message,
      statusCode,
    },
  };
};
