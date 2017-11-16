module.exports = () => (req, res) => {
  res.status(404).json({
    error: {
      status: '404',
      title: 'Not Found',
      detail: `No resource available for ${req.method} ${req.path}`,
    },
  });
};
