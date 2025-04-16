import React, { useState, useEffect } from "react";
import { Container, Row, Col, Dropdown } from "react-bootstrap";
import HoldingsPieChart from "./Components/HoldingsPieChart";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [holdingsData, setHoldingsData] = useState(null);

  useEffect(() => {
    fetchHoldingsData();
  }, []);

  const fetchHoldingsData = async () => {
    const response = await fetch("http://localhost:5000/api/holdings");
    const data = await response.json();
    console.log(data);
    setHoldingsData(data);
  };

  return (
    <Container fluid>
      <Row className="justify-content-center mt-3">
        <Col md={8} className="text-center">
          <h1>Dividend Dashboard</h1>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col md={6}>
          {holdingsData && <HoldingsPieChart data={holdingsData} />}
        </Col>
      </Row>
    </Container>
  );
}

export default App;
