package main


import (
	"encoding/json"
	"fmt"
	"bytes"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
)

type SmartContract struct {

}
 
/*
We will use InvoiceId as Unique ID to Track 
According to fabric interface (shim) unique id should be string .. 
*/

//Invoice structure 
 type Invoice struct {
 OTHash                   string   `json:"oTHash"`
 BuyerID                  string   `json:"buyerID"`
 SellerID                 string   `json:"sellerID"`
 PropertyID               string   `json:"propertyID"`
 MpdNocHash               string   `json:"mpdNocHash"`
 FewaNocHash              string   `json:"fewaNocHash"`
 MojNocHash               string   `json:"mojNocHash"`
 BuyerIBAN                string   `json:"buyerIBAN"`
 SellerIBAN               string   `json:"sellerIBAN"`
 Swift                    string   `json:"swift"`
 Amount                   string   `json:"amount"`
 ApprovedMortgageHash     string   `json:"approvedMortgageHash"`
 Status                   string   `json:"status"`
} 

 
 func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}
 
  //Function to check if the request is valid or not
func (s *SmartContract) RequestAuth(APIstub shim.ChaincodeStubInterface, function string, args []string) bool {

	// One can have any type of check here..
	return true

}
 
 //Main Controller which will receive request
func (s *SmartContract) Controller(APIstub shim.ChaincodeStubInterface) sc.Response {

	function, args := APIstub.GetFunctionAndParameters()
	if len(args) < 1 {
		str := fmt.Sprintf("Invalid request")
		return shim.Error(str)
	}

	fmt.Println(function)
	fmt.Println(args)

	//guard
	authorized := s.RequestAuth(APIstub, function, args)

	if !authorized {
		str := fmt.Sprintf("Unauthorized operation in request")
		return shim.Error(str)
	}

	return s.InvokeController(APIstub, function, args)
}
 
 // AccountChaincode request controller
func (s *SmartContract) InvokeController(APIstub shim.ChaincodeStubInterface, function string, args []string) sc.Response {

	// Route to the appropriate handler function to interact with the ledger appropriately
	if function == "query" {
		return s.query(APIstub, args)
	} else if function == "create" {
		return s.create(APIstub, args)
	} else if function == "delete" {
		return s.delete(APIstub, args)
	} else if function == "approveMortgageRequest" {
		return s.approveMortgageRequest(APIstub, args)
	} else if function == "confirmMoneyTransferToSeller" {
		return s.confirmMoneyTransferToSeller(APIstub, args)
	} else if function == "queryAll" {
		return s.queryAll(APIstub)
	}

	return shim.Error("Invalid Smart Contract function name.")
}
 
 func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {
	return s.Controller(APIstub)
}
 
 // Create record for the request
func (s *SmartContract) create(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	fmt.Println(args)
	fmt.Println(len(args))

	if len(args) != 1 {
		str := fmt.Sprintf("Invalid request : invalid number of arguments!")
		return shim.Error(str)
	}

	data := Invoice{}

	err := json.Unmarshal([]byte(args[0]), &data)
	if err != nil {
		str := fmt.Sprintf("JSON Parsing exception: %+v", err)
		return shim.Error(str)
	}

	fmt.Printf("%v", data)
	UniqueID := data.OTHash

	dataAsBytes, err := APIstub.GetState(UniqueID)
	if err != nil {
		return shim.Error("Failed to get account: " + err.Error())
	} else if dataAsBytes != nil {
		fmt.Println("This account already exists")
		return shim.Error("This account already exists")
	}

	//reason why we again are marshalling and not just storing args[0] is to
	//remove any extra data which is not required and stored only struct specified fields
	dataAsBytes, err = json.Marshal(data)
	if err != nil {
		str := fmt.Sprintf("Can not marshal %+v", err.Error())
		return shim.Error(str)
	}

	err = APIstub.PutState(UniqueID, dataAsBytes)
	if err != nil {
		str := fmt.Sprintf("Problem occured while saving the information")
		return shim.Error(str)
	}
	fmt.Println(fmt.Sprintf("Sucessfully tested %s", dataAsBytes))
	APIstub.SetEvent("invoice_created", dataAsBytes)
	return shim.Success(dataAsBytes)
}
 
 func (s *SmartContract) query(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	objAsBytes, _ := APIstub.GetState(args[0])
	APIstub.SetEvent("invoice_query", objAsBytes)
	return shim.Success(objAsBytes)
}
 
 // approveMortgageRequest record as per the request
func (s *SmartContract) approveMortgageRequest(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	fmt.Println(args)
	fmt.Println(len(args))

	if len(args) < 1 {
		str := fmt.Sprintf("Invalid request : invalid number of arguments!")
		return shim.Error(str)
	}

	data := &Invoice{}
	err := json.Unmarshal([]byte(args[0]), &data)

	if err != nil {
		str := fmt.Sprintf("JSON Parsing exception: %+v", err)
		return shim.Error(str)
	}

	UniqueID := data.OTHash

	dataAsBytes, err := APIstub.GetState(UniqueID)

	if err != nil {
		str := fmt.Sprintf("Problem occured while checking the information")
		return shim.Error(str)
	} else if dataAsBytes == nil {
		str := fmt.Sprintf("Information does not exists for Invoice")
		return shim.Error(str)
	}

	err = APIstub.PutState(UniqueID, []byte(args[0]))
	if err != nil {
		str := fmt.Sprintf("Can not put state %+v", err.Error())
		return shim.Error(str)
	}

	fmt.Println(fmt.Sprintf("Sucessfully tested %s", []byte(args[0])))

	return shim.Success([]byte("Success"))
}

// confirmMonyTransferToSeller record as per the request
func (s *SmartContract) confirmMoneyTransferToSeller(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	fmt.Println(args)
	fmt.Println(len(args))

	if len(args) < 1 {
		str := fmt.Sprintf("Invalid request : invalid number of arguments!")
		return shim.Error(str)
	}

	data := Invoice{}
	err := json.Unmarshal([]byte(args[0]), &data)

	if err != nil {
		str := fmt.Sprintf("JSON Parsing exception: %+v", err)
		return shim.Error(str)
	}

	fmt.Printf("%v", data)
	UniqueID := data.OTHash

	dataAsBytes, err := APIstub.GetState(UniqueID)

	if err != nil {
		str := fmt.Sprintf("Problem occured while checking the information")
		return shim.Error(str)
	} else if dataAsBytes == nil {
		str := fmt.Sprintf("Information does not exists for Invoice")
		return shim.Error(str)
	}


	//reason why we again are marshalling and not just storing args[0] is to
	//remove any extra data which is not required and stored only struct specified fields
	dataAsBytes, err = json.Marshal(data)
	if err != nil {
		str := fmt.Sprintf("Can not marshal %+v", err.Error())
		return shim.Error(str)
	}

	err = APIstub.PutState(UniqueID, dataAsBytes)
	if err != nil {
		str := fmt.Sprintf("Can not put state %+v", err.Error())
		return shim.Error(str)
	}
	fmt.Println(fmt.Sprintf("Sucessfully tested before event%s", "dataAsBytes"))
	APIstub.SetEvent("invoice_approved", dataAsBytes)
	return shim.Success(dataAsBytes);
}

func (s *SmartContract) queryAll(APIstub shim.ChaincodeStubInterface) sc.Response {

	startKey := ""
	endKey := ""

	resultsIterator, err := APIstub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAll:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

 
 // Deletes an entity from state
func (s *SmartContract) delete(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	// Delete the key from the state in ledger
	err := APIstub.DelState(args[0])
	if err != nil {
		return shim.Error("Failed to delete state")
	}

	return shim.Success(nil)
}
 
 func main() {

	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}