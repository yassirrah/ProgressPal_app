import React from 'react';

const Home = () => {
  const token = localStorage.getItem('token');

  return (
    <div>
      <h1>Welcome to the App</h1>
      {token ? (
        <p>You are logged in! Start tracking your activities.</p>
      ) : (
        <p>Please <a href="/login">login</a> or <a href="/signup">sign up</a> to get started.</p>
      )}
    </div>
  );
};

export default Home;